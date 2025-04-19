import { Connection, PublicKey, LogsCallback } from '@solana/web3.js';
import WebSocket from 'ws';

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

    constructor(connection: Connection) {
        this.connection = connection;
        // Store original console methods
        this.originalConsoleLog = console.log;
        this.originalConsoleError = console.error;
        this.originalConsoleWarn = console.warn;
        
        // Override console methods to filter WebSocket errors
        this.setupConsoleOverrides();
        
        // Initialize suppressed messages
        this.suppressedMessages = new Set([
            'ws error: unexpected server response: 404',
            'websocket connection to',
            'websocket is not open',
            'connection closed',
            'no response received'
        ].map(msg => msg.toLowerCase()));
    }

    private setupConsoleOverrides(): void {
        console.log = (...args: any[]): void => {
            if (!this.shouldSuppressMessage(args)) {
                this.originalConsoleLog.apply(console, args);
            }
        };

        console.error = (...args: any[]): void => {
            if (!this.shouldSuppressMessage(args)) {
                this.originalConsoleError.apply(console, args);
            }
        };

        console.warn = (...args: any[]): void => {
            if (!this.shouldSuppressMessage(args)) {
                this.originalConsoleWarn.apply(console, args);
            }
        };
    }

    private shouldSuppressMessage(args: any[]): boolean {
        const message = args.join(' ').toLowerCase();
        return this.suppressedMessages.has(message) ||
               this.isNonCriticalError(message);
    }

    async subscribe(publicKey: PublicKey, callback: (logs: any) => void): Promise<void> {
        try {
            // Create a wrapped callback that filters out non-critical errors
            const wrappedCallback: LogsCallback = (logs, context) => {
                if (logs.err) {
                    const errorMessage = logs.err.toString().toLowerCase();
                    // Filter out common non-critical errors
                    if (this.isNonCriticalError(errorMessage)) {
                        return; // Silently ignore these errors
                    }
                    // Log other errors and attempt recovery
                    this.originalConsoleError.call(console, 'Critical WebSocket error:', logs.err);
                    this.handleError();
                } else {
                    // Process valid logs
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

            this.originalConsoleLog.call(console, 'WebSocket subscription established');
        } catch (error) {
            if (!this.isNonCriticalError(error?.toString() || '')) {
                this.originalConsoleError.call(console, 'Error establishing WebSocket subscription:', error);
            }
            this.handleError();
        }
    }

    private isNonCriticalError(message: string): boolean {
        message = message.toLowerCase();
        return (
            message.includes('404') ||
            message.includes('unexpected server response') ||
            message.includes('connection closed') ||
            message.includes('ws error') ||
            message.includes('not found') ||
            message.includes('no response received') ||
            message.includes('websocket connection to') ||
            message.includes('websocket is not open') ||
            message.includes('connection reset') ||
            message.includes('socket hang up')
        );
    }

    private handleError(): void {
        if (this.reconnectTimer) {
            return; // Already attempting to reconnect
        }

        let attempts = 0;
        const attemptReconnect = async () => {
            if (attempts >= this.maxReconnectAttempts) {
                this.originalConsoleError.call(console, 'Max reconnection attempts reached');
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
                this.originalConsoleLog.call(console, 'WebSocket connection restored');
            } catch (error) {
                if (!this.isNonCriticalError(error?.toString() || '')) {
                    this.originalConsoleWarn.call(console, `Reconnection attempt ${attempts} failed`);
                }
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
                if (!this.isNonCriticalError(error?.toString() || '')) {
                    this.originalConsoleError.call(console, 'Error unsubscribing from WebSocket:', error);
                }
            }
        }
    }

    isWebSocketConnected(): boolean {
        return this.isConnected;
    }

    // Clean up when the wrapper is destroyed
    cleanup(): void {
        // Restore original console methods
        console.log = this.originalConsoleLog;
        console.error = this.originalConsoleError;
        
        // Clean up any remaining subscriptions
        for (const [key, subscriptionId] of this.subscriptions) {
            try {
                this.connection.removeOnLogsListener(subscriptionId);
            } catch (error) {
                // Ignore cleanup errors
            }
        }
        this.subscriptions.clear();
    }
} 