import { Injectable } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ConfigService {
  private readonly envConfig: { [key: string]: string };
  private readonly dotEnvEntries: { [key: string]: string } = {}; // Added for .env specific entries

  constructor() {
    const isLambdaEnvironment = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
    let envFilePath = '.env'; // Default for local development
    const mutableEnvConfig: { [key: string]: string } = {
      ...process.env,
    } as { [key: string]: string };

    if (isLambdaEnvironment) {
      // In AWS Lambda, environment variables are directly available
      // dotEnvEntries remains empty as we don't parse .env in Lambda for this specific requirement
    } else {
      // For local development, load from .env file if it exists
      envFilePath = path.resolve(process.cwd(), '.env');

      if (fs.existsSync(envFilePath)) {
        const localEnvConfig = dotenv.parse(fs.readFileSync(envFilePath));
        this.dotEnvEntries = localEnvConfig; // Store .env specific entries

        // Merge localEnvConfig into mutableEnvConfig, allowing .env to override process.env
        // And also add short keys from .env
        for (const fullKey in localEnvConfig) {
          if (Object.prototype.hasOwnProperty.call(localEnvConfig, fullKey)) {
            const value = localEnvConfig[fullKey];
            mutableEnvConfig[fullKey] = value; // Add/overwrite with full key

            const lastDotIndex = fullKey.lastIndexOf('.');
            if (lastDotIndex !== -1 && lastDotIndex < fullKey.length - 1) {
              const shortKey = fullKey.substring(lastDotIndex + 1);
              if (shortKey) {
                // Ensure shortKey is not empty
                mutableEnvConfig[shortKey] = value; // Add/overwrite with short key
              }
            }
          }
        }
      } else {
        console.warn(
          `.env file not found at ${envFilePath}. Using only process environment variables.`,
        );
        // dotEnvEntries remains empty
      }
    }
    this.envConfig = mutableEnvConfig;
  }

  get(key: string): string | undefined {
    return this.envConfig[key];
  }

  // Optional: A method to get a value or throw an error if not found
  getOrThrow(key: string): string {
    const value = this.get(key);
    if (value === undefined) {
      throw new Error(`Configuration key "${key}" not found`);
    }
    return value;
  }
  getAll(): { [key: string]: string } {
    return this.envConfig;
  }

  getDotEnvEntries(): { [key: string]: string } {
    return this.dotEnvEntries;
  }
}
