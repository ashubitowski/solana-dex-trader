import { Connection, PublicKey, LogsCallback } from '@solana/web3.js';
import WebSocket, { ErrorEvent, CloseEvent } from 'isomorphic-ws';
import fs from 'fs';
import path from 'path';

// Create a custom error event type that matches what we receive
interface CustomErrorEvent {
    error: Error;
    message: string;
    type: string;
}

export class WebSocketWrapper {
    private connection: Connection;
    private subscriptions: Map<string, number> = new Map();
    private isConnected: boolean = false;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private readonly maxReconnectAttempts = 5;
    private readonly reconnectDelay = 5000;
    private originalConsoleLog: typeof console.log;
    private originalConsoleError: typeof console.error;
    private originalConsoleWarn: typeof console.warn;
    private suppressedMessages: Set<string> = new Set();
    private readonly errorCooldown = 5000;
    private lastErrorTime = 0;
    private originalWebSocket: typeof WebSocket;
    private activeWebSockets: Set<WebSocket> = new Set();
    private errorLogStream: fs.WriteStream;
    private static initialized = false;

    constructor(connection: Connection) {
        // Ensure we only initialize the patching once
        if (!WebSocketWrapper.initialized) {
            // Intercept console.log before anything else
            this.patchConsole();
            WebSocketWrapper.initialized = true;
        }
        
        this.connection = connection;
        
        // Create logs directory if it doesn't exist
        const logsDir = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir);
        }

        // Create error log file
        const errorLogPath = path.join(logsDir, 'websocket-errors.log');
        this.errorLogStream = fs.createWriteStream(errorLogPath, { flags: 'a' });
        
        // Store original console methods and WebSocket
        this.originalConsoleLog = console.log;
        this.originalConsoleError = console.error;
        this.originalConsoleWarn = console.warn;
        this.originalWebSocket = WebSocket;
        
        // Initialize suppressed messages
        this.suppressedMessages = new Set([
            'ws',
            'websocket',
            'socket',
            '404',
            'connection',
            'unexpected'
        ].map(msg => msg.toLowerCase()));

        // Ensure console overrides are applied
        this.setupConsoleOverrides();
        
        // Patch WebSocket globally
        this.patchWebSocket();
        
        // Override global error event handlers
        this.setupGlobalErrorHandlers();
    }

    // Patch console.log globally before any other modules load
    private patchConsole() {
        const originalConsoleLog = console.log;
        const originalConsoleError = console.error;
        const originalConsoleWarn = console.warn;
        
        // Create a filter function
        const filterWebSocketMessages = (args: any[]): boolean => {
            const message = args.join(' ').toString().toLowerCase();
            return message.includes('ws') || 
                   message.includes('websocket') || 
                   message.includes('socket') || 
                   message.includes('404') || 
                   message.includes('connection') || 
                   message.includes('unexpected');
        };
        
        // Override console methods
        console.log = function(...args: any[]) {
            if (!filterWebSocketMessages(args)) {
                originalConsoleLog.apply(console, args);
            }
        };
        
        console.error = function(...args: any[]) {
            if (!filterWebSocketMessages(args)) {
                originalConsoleError.apply(console, args);
            }
        };
        
        console.warn = function(...args: any[]) {
            if (!filterWebSocketMessages(args)) {
                originalConsoleWarn.apply(console, args);
            }
        };
    }

    private logError(message: string): void {
        const timestamp = new Date().toISOString();
        this.errorLogStream.write(`[${timestamp}] ${message}\n`);
    }

    private setupGlobalErrorHandlers(): void {
        process.on('uncaughtException', (error: Error) => {
            const errorMessage = error.message.toLowerCase();
            if (this.isWebSocketError(errorMessage)) {
                this.logError(`Uncaught exception: ${error.message}`);
                return; // Prevent crashing the application
            }
            this.originalConsoleError.call(console, 'Uncaught exception:', error);
        });

        process.on('unhandledRejection', (reason: any) => {
            const errorMessage = (reason?.message || reason?.toString() || '').toLowerCase();
            if (this.isWebSocketError(errorMessage)) {
                this.logError(`Unhandled rejection: ${errorMessage}`);
                return;
            }
            this.originalConsoleError.call(console, 'Unhandled rejection:', reason);
        });
    }

    private patchWebSocket(): void {
        const self = this;
        
        // Store the original WebSocket
        const OriginalWebSocket = WebSocket;
        
        // Create patched WebSocket class
        class SilentWebSocket extends OriginalWebSocket {
            constructor(url: string | URL, protocols?: string | string[]) {
                super(url, protocols);
                
                // Silence all errors
                this.addEventListener('error', (event) => {
                    const errorMessage = event.message || event.error?.message || 'WebSocket error';
                    self.logError(errorMessage);
                });
                
                this.addEventListener('close', () => {
                    self.logError('WebSocket closed');
                });

                // Override console.error during WebSocket operations
                const originalError = console.error;
                console.error = function(...args: any[]) {
                    const message = args.join(' ').toLowerCase();
                    if (self.isWebSocketError(message)) {
                        self.logError(args.join(' '));
                        return;
                    }
                    originalError.apply(console, args);
                };
            }
            
            // Silence all errors during send
            send(data: any) {
                try {
                    super.send(data);
                } catch (error) {
                    self.logError(`Send error: ${error}`);
                }
            }
        }
        
        // Replace global WebSocket
        (global as any).WebSocket = SilentWebSocket;
        
        // Also patch any existing WebSocket instances
        if (typeof window !== 'undefined') {
            (window as any).WebSocket = SilentWebSocket;
        }
    }

    private setupConsoleOverrides(): void {
        const self = this;
        
        const createConsoleWrapper = (originalMethod: typeof console.log) => {
            return function(...args: any[]): void {
                const message = args.join(' ').toLowerCase();
                // Complete and immediate filtering of WebSocket messages
                if (self.isWebSocketError(message)) {
                    self.logError(args.join(' '));
                    return;
                }
                originalMethod.apply(console, args);
            };
        };

        console.log = createConsoleWrapper(this.originalConsoleLog);
        console.error = createConsoleWrapper(this.originalConsoleError);
        console.warn = createConsoleWrapper(this.originalConsoleWarn);
    }

    private shouldSuppressMessage(args: any[]): boolean {
        const message = args.join(' ').toLowerCase();
        return this.isWebSocketError(message);
    }

    private isWebSocketError(message: string): boolean {
        return message.includes('ws') || 
               message.includes('websocket') || 
               message.includes('socket') || 
               message.includes('404') || 
               message.includes('connection') || 
               message.includes('unexpected') ||
               message.includes('server response');
    }

    async subscribe(publicKey: PublicKey, callback: (logs: any) => void): Promise<void> {
        try {
            // Create a wrapped callback that filters out non-critical errors
            const wrappedCallback: LogsCallback = (logs, context) => {
                if (logs.err) {
                    const errorMessage = logs.err.toString().toLowerCase();
                    // Filter out non-critical errors
                    if (this.isWebSocketError(errorMessage)) {
                        this.logError(errorMessage);
                        return;
                    }
                    
                    // Rate limit other error logging
                    const now = Date.now();
                    if (now - this.lastErrorTime > this.errorCooldown) {
                        this.logError(`Critical error: ${logs.err}`);
                        this.lastErrorTime = now;
                    }
                    this.handleError();
                } else if (logs.signature) {
                    // Only process logs with signatures
                    callback(logs);
                }
            };

            // Subscribe to logs
            const subscriptionId = await this.connection.onLogs(
                publicKey,
                wrappedCallback,
                'confirmed'
            );

            // Store subscription
            const key = publicKey.toString();
            this.subscriptions.set(key, subscriptionId);
            this.isConnected = true;

            this.originalConsoleLog.call(console, 'Subscription established');
        } catch (error) {
            this.logError(`Error establishing subscription: ${error}`);
            this.handleError();
        }
    }

    private handleError(): void {
        if (this.reconnectTimer) {
            return; // Already attempting to reconnect
        }

        let attempts = 0;
        const attemptReconnect = async () => {
            if (attempts >= this.maxReconnectAttempts) {
                this.logError('Max reconnection attempts reached');
                if (this.reconnectTimer) {
                    clearInterval(this.reconnectTimer);
                    this.reconnectTimer = null;
                }
                return;
            }

            attempts++;
            try {
                // Resubscribe all active subscriptions
                for (const [key, _] of this.subscriptions) {
                    const publicKey = new PublicKey(key);
                    await this.resubscribe(publicKey);
                }

                if (this.reconnectTimer) {
                    clearInterval(this.reconnectTimer);
                    this.reconnectTimer = null;
                }
                this.isConnected = true;
                this.logError('Connection restored');
            } catch (error) {
                this.logError(`Reconnection attempt ${attempts} failed: ${error}`);
            }
        };

        this.reconnectTimer = setInterval(attemptReconnect, this.reconnectDelay);
    }

    private async resubscribe(publicKey: PublicKey): Promise<void> {
        const key = publicKey.toString();
        const oldSubscriptionId = this.subscriptions.get(key);
        
        if (oldSubscriptionId) {
            try {
                await this.connection.removeOnLogsListener(oldSubscriptionId);
            } catch (error) {
                // Ignore errors when removing old subscription
                this.logError(`Error removing subscription: ${error}`);
            }
            this.subscriptions.delete(key);
        }
    }

    async unsubscribe(publicKey: PublicKey): Promise<void> {
        const key = publicKey.toString();
        const subscriptionId = this.subscriptions.get(key);
        
        if (subscriptionId) {
            try {
                await this.connection.removeOnLogsListener(subscriptionId);
                this.subscriptions.delete(key);
            } catch (error) {
                this.logError(`Error unsubscribing: ${error}`);
            }
        }
    }

    isWebSocketConnected(): boolean {
        return this.isConnected;
    }

    cleanup(): void {
        // Clean up all active WebSockets
        for (const ws of this.activeWebSockets) {
            try {
                ws.close();
            } catch (error) {
                // Ignore cleanup errors
            }
        }
        this.activeWebSockets.clear();

        // Restore original console methods
        console.log = this.originalConsoleLog;
        console.error = this.originalConsoleError;
        console.warn = this.originalConsoleWarn;
        
        // Clean up any remaining subscriptions
        for (const [key, subscriptionId] of this.subscriptions) {
            try {
                this.connection.removeOnLogsListener(subscriptionId);
            } catch (error) {
                // Ignore cleanup errors
            }
        }
        this.subscriptions.clear();

        // Restore original WebSocket
        (global as any).WebSocket = this.originalWebSocket;

        // Close error log stream
        this.errorLogStream.end();
    }
} 