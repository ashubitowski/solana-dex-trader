import { Handler } from 'aws-lambda';
import * as fs from 'fs';
import * as path from 'path';

export const handler: Handler = async () => {
  try {
    const logPath = path.join(process.cwd(), 'logs', 'websocket-errors.log');
    let logs: string[] = [];
    if (fs.existsSync(logPath)) {
      const content = fs.readFileSync(logPath, 'utf-8');
      logs = content.split('\n').slice(-100); // Last 100 lines
    }
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, logs })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error instanceof Error ? error.message : error })
    };
  }
};
