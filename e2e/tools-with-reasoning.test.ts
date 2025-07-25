import type { ModelMessage } from 'ai';

import { generateText } from 'ai';
import { it, vi } from 'vitest';
import {
  executeCommandInTerminalTool,
  readSMSTool,
  sendSMSTool,
} from '@/e2e/tools';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 42_000,
});

const prompts = [
  'The flight to San Francisco is delayed by 2 hours. Send an SMS to 808-999-2345 with the flight delay information.',
  'Find out if the SMS was delivered properly.',
];

describe('Vercel AI SDK tools call with reasoning', () => {
  it('should work with reasoning content', async () => {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
    });

    const model = openrouter('anthropic/claude-sonnet-4', {
      usage: {
        include: true,
      },
    });
    const messageHistory: ModelMessage[] = [];
    for (const prompt of prompts) {
      messageHistory.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt,
          },
        ],
      });

      const response = await generateText({
        model,
        system:
          'You are an airline assistant. You can send and read SMS messages, and execute commands in the terminal.',
        messages: messageHistory,
        tools: {
          readSMS: readSMSTool,
          sendSMS: sendSMSTool,
          executeCommand: executeCommandInTerminalTool,
        },
        providerOptions: {
          openrouter: {
            reasoning: {
              max_tokens: 2048,
            },
          },
        },
      });

      const content = response.steps.map((step) => ({
        type: 'text' as const,
        text: step.text,
      }));

      messageHistory.push({
        role: 'assistant',
        content,
      });
    }
  });
});
