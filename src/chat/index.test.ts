import type { LanguageModelV2Prompt } from '@ai-sdk/provider';

import {
  convertReadableStreamToArray,
  createTestServer,
} from '@ai-sdk/provider-utils/test';
import { createOpenRouter } from '../provider';

const TEST_PROMPT: LanguageModelV2Prompt = [
  { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
];

const TEST_LOGPROBS = {
  content: [
    {
      token: 'Hello',
      logprob: -0.0009994634,
      top_logprobs: [
        {
          token: 'Hello',
          logprob: -0.0009994634,
        },
      ],
    },
    {
      token: '!',
      logprob: -0.13410144,
      top_logprobs: [
        {
          token: '!',
          logprob: -0.13410144,
        },
      ],
    },
    {
      token: ' How',
      logprob: -0.0009250381,
      top_logprobs: [
        {
          token: ' How',
          logprob: -0.0009250381,
        },
      ],
    },
    {
      token: ' can',
      logprob: -0.047709424,
      top_logprobs: [
        {
          token: ' can',
          logprob: -0.047709424,
        },
      ],
    },
    {
      token: ' I',
      logprob: -0.000009014684,
      top_logprobs: [
        {
          token: ' I',
          logprob: -0.000009014684,
        },
      ],
    },
    {
      token: ' assist',
      logprob: -0.009125131,
      top_logprobs: [
        {
          token: ' assist',
          logprob: -0.009125131,
        },
      ],
    },
    {
      token: ' you',
      logprob: -0.0000066306106,
      top_logprobs: [
        {
          token: ' you',
          logprob: -0.0000066306106,
        },
      ],
    },
    {
      token: ' today',
      logprob: -0.00011093382,
      top_logprobs: [
        {
          token: ' today',
          logprob: -0.00011093382,
        },
      ],
    },
    {
      token: '?',
      logprob: -0.00004596782,
      top_logprobs: [
        {
          token: '?',
          logprob: -0.00004596782,
        },
      ],
    },
  ],
};

const provider = createOpenRouter({
  apiKey: 'test-api-key',
  compatibility: 'strict',
});

const model = provider.chat('anthropic/claude-3.5-sonnet');

describe('doGenerate', () => {
  const server = createTestServer({
    'https://openrouter.ai/api/v1/chat/completions': {
      response: { type: 'json-value', body: {} },
    },
  });

  function prepareJsonResponse({
    content = '',
    usage = {
      prompt_tokens: 4,
      total_tokens: 34,
      completion_tokens: 30,
    },
    logprobs = null,
    finish_reason = 'stop',
  }: {
    content?: string;
    usage?: {
      prompt_tokens: number;
      total_tokens: number;
      completion_tokens: number;
    };
    logprobs?: {
      content:
        | {
            token: string;
            logprob: number;
            top_logprobs: { token: string; logprob: number }[];
          }[]
        | null;
    } | null;
    finish_reason?: string;
  } = {}) {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'json-value',
      body: {
        id: 'chatcmpl-95ZTZkhr0mHNKqerQfiwkuox3PHAd',
        object: 'chat.completion',
        created: 1711115037,
        model: 'gpt-3.5-turbo-0125',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content,
            },
            logprobs,
            finish_reason,
          },
        ],
        usage,
        system_fingerprint: 'fp_3bc1b5746c',
      },
    };
  }

  it('should extract text response', async () => {
    prepareJsonResponse({ content: 'Hello, World!' });

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(result.content[0]).toStrictEqual({
      type: 'text',
      text: 'Hello, World!',
    });
  });

  it('should extract usage', async () => {
    prepareJsonResponse({
      content: '',
      usage: { prompt_tokens: 20, total_tokens: 25, completion_tokens: 5 },
    });

    const { usage } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(usage).toStrictEqual({
      inputTokens: 20,
      outputTokens: 5,
      totalTokens: 25,
      reasoningTokens: 0,
      cachedInputTokens: 0,
    });
  });

  it('should extract logprobs', async () => {
    prepareJsonResponse({
      logprobs: TEST_LOGPROBS,
    });

    await provider.chat('openai/gpt-3.5-turbo', { logprobs: 1 }).doGenerate({
      prompt: TEST_PROMPT,
    });
  });

  it('should extract finish reason', async () => {
    prepareJsonResponse({
      content: '',
      finish_reason: 'stop',
    });

    const response = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(response.finishReason).toStrictEqual('stop');
  });

  it('should support unknown finish reason', async () => {
    prepareJsonResponse({
      content: '',
      finish_reason: 'eos',
    });

    const response = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(response.finishReason).toStrictEqual('unknown');
  });

  it('should pass the model and the messages', async () => {
    prepareJsonResponse({ content: '' });

    await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(await server.calls[0]!.requestBodyJson).toStrictEqual({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [{ role: 'user', content: 'Hello' }],
    });
  });

  it('should pass the models array when provided', async () => {
    prepareJsonResponse({ content: '' });

    const customModel = provider.chat('anthropic/claude-3.5-sonnet', {
      models: ['anthropic/claude-2', 'gryphe/mythomax-l2-13b'],
    });

    await customModel.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(await server.calls[0]!.requestBodyJson).toStrictEqual({
      model: 'anthropic/claude-3.5-sonnet',
      models: ['anthropic/claude-2', 'gryphe/mythomax-l2-13b'],
      messages: [{ role: 'user', content: 'Hello' }],
    });
  });

  it('should pass settings', async () => {
    prepareJsonResponse();

    await provider
      .chat('openai/gpt-3.5-turbo', {
        logitBias: { 50256: -100 },
        logprobs: 2,
        parallelToolCalls: false,
        user: 'test-user-id',
      })
      .doGenerate({
        prompt: TEST_PROMPT,
      });

    expect(await server.calls[0]!.requestBodyJson).toStrictEqual({
      model: 'openai/gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello' }],
      logprobs: true,
      top_logprobs: 2,
      logit_bias: { 50256: -100 },
      parallel_tool_calls: false,
      user: 'test-user-id',
    });
  });

  it('should pass tools and toolChoice', async () => {
    prepareJsonResponse({ content: '' });

    await model.doGenerate({
      prompt: TEST_PROMPT,
      tools: [
        {
          type: 'function',
          name: 'test-tool',
          inputSchema: {
            type: 'object',
            properties: { value: { type: 'string' } },
            required: ['value'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      toolChoice: {
        type: 'tool',
        toolName: 'test-tool',
      },
    });

    expect(await server.calls[0]!.requestBodyJson).toStrictEqual({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [{ role: 'user', content: 'Hello' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'test-tool',
            description: 'function',
            parameters: {
              type: 'object',
              properties: { value: { type: 'string' } },
              required: ['value'],
              additionalProperties: false,
              $schema: 'http://json-schema.org/draft-07/schema#',
            },
          },
        },
      ],
      tool_choice: {
        type: 'function',
        function: { name: 'test-tool' },
      },
    });
  });

  it('should pass headers', async () => {
    prepareJsonResponse({ content: '' });

    const provider = createOpenRouter({
      apiKey: 'test-api-key',
      headers: {
        'Custom-Provider-Header': 'provider-header-value',
      },
    });

    await provider.chat('openai/gpt-3.5-turbo').doGenerate({
      prompt: TEST_PROMPT,
      headers: {
        'Custom-Request-Header': 'request-header-value',
      },
    });

    const requestHeaders = server.calls[0]!.requestHeaders;

    expect(requestHeaders).toStrictEqual({
      authorization: 'Bearer test-api-key',
      'content-type': 'application/json',
      'custom-provider-header': 'provider-header-value',
      'custom-request-header': 'request-header-value',
    });
  });
});

describe('doStream', () => {
  const server = createTestServer({
    'https://openrouter.ai/api/v1/chat/completions': {
      response: { type: 'json-value', body: {} },
    },
  });

  function prepareStreamResponse({
    content,
    usage = {
      prompt_tokens: 17,
      total_tokens: 244,
      completion_tokens: 227,
    },
    logprobs = null,
    finish_reason = 'stop',
  }: {
    content: string[];
    usage?: {
      prompt_tokens: number;
      total_tokens: number;
      completion_tokens: number;
    };
    logprobs?: {
      content:
        | {
            token: string;
            logprob: number;
            top_logprobs: { token: string; logprob: number }[];
          }[]
        | null;
    } | null;
    finish_reason?: string;
  }) {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613",` +
          `"system_fingerprint":null,"choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n`,
        ...content.flatMap((text) => {
          return `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","system_fingerprint":null,"choices":[{"index":1,"delta":{"content":"${text}"},"finish_reason":null}]}\n\n`;
        }),
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","system_fingerprint":null,"choices":[{"index":0,"delta":{},"finish_reason":"${finish_reason}","logprobs":${JSON.stringify(
          logprobs,
        )}}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","system_fingerprint":"fp_3bc1b5746c","choices":[],"usage":${JSON.stringify(
          usage,
        )}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };
  }

  it('should stream text deltas', async () => {
    prepareStreamResponse({
      content: ['Hello', ', ', 'World!'],
      finish_reason: 'stop',
      usage: {
        prompt_tokens: 17,
        total_tokens: 244,
        completion_tokens: 227,
      },
      logprobs: TEST_LOGPROBS,
    });

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    // note: space moved to last chunk bc of trimming
    const elements = await convertReadableStreamToArray(stream);
    expect(elements).toStrictEqual([
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0613',
      },
      {
        type: 'text-start',
        id: expect.any(String),
      },
      { type: 'text-delta', delta: '', id: expect.any(String) },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0613',
      },
      { type: 'text-delta', delta: 'Hello', id: expect.any(String) },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0613',
      },
      { type: 'text-delta', delta: ', ', id: expect.any(String) },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0613',
      },
      { type: 'text-delta', delta: 'World!', id: expect.any(String) },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0613',
      },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0613',
      },
      {
        type: 'text-end',
        id: expect.any(String),
      },
      {
        type: 'finish',
        finishReason: 'stop',

        providerMetadata: {
          openrouter: {
            usage: {
              completionTokens: 227,
              promptTokens: 17,
              totalTokens: 244,
              cost: undefined,
            },
          },
        },
        usage: {
          inputTokens: 17,
          outputTokens: 227,
          totalTokens: 244,
          reasoningTokens: Number.NaN,
          cachedInputTokens: Number.NaN,
        },
      },
    ]);
  });

  it('should stream tool deltas', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[{"index":0,"id":"call_O17Uplv4lJvD6DVdIvFFeRMw","type":"function","function":{"name":"test-tool","arguments":""}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\""}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"value"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\":\\""}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"Spark"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"le"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":" Day"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"}"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[],"usage":{"prompt_tokens":53,"completion_tokens":17,"total_tokens":70}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      tools: [
        {
          type: 'function',
          name: 'test-tool',
          inputSchema: {
            type: 'object',
            properties: { value: { type: 'string' } },
            required: ['value'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      prompt: TEST_PROMPT,
    });

    expect(await convertReadableStreamToArray(stream)).toStrictEqual([
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0125',
      },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0125',
      },
      {
        id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
        toolName: 'test-tool',
        type: 'tool-input-start',
      },
      {
        type: 'tool-input-delta',
        id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
        delta: '{"',
      },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0125',
      },
      {
        type: 'tool-input-delta',
        id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
        delta: 'value',
      },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0125',
      },
      {
        type: 'tool-input-delta',
        id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
        delta: '":"',
      },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0125',
      },
      {
        type: 'tool-input-delta',
        id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
        delta: 'Spark',
      },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0125',
      },
      {
        type: 'tool-input-delta',
        id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
        delta: 'le',
      },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0125',
      },
      {
        type: 'tool-input-delta',
        id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
        delta: ' Day',
      },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0125',
      },
      {
        type: 'tool-input-delta',
        id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
        delta: '"}',
      },
      {
        type: 'tool-call',
        toolCallId: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
        toolName: 'test-tool',
        input: '{"value":"Sparkle Day"}',
      },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0125',
      },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0125',
      },
      {
        type: 'finish',
        finishReason: 'tool-calls',
        providerMetadata: {
          openrouter: {
            usage: {
              completionTokens: 17,
              promptTokens: 53,
              totalTokens: 70,
              cost: undefined,
            },
          },
        },
        usage: {
          inputTokens: 53,
          outputTokens: 17,
          totalTokens: 70,
          reasoningTokens: Number.NaN,
          cachedInputTokens: Number.NaN,
        },
      },
    ]);
  });

  it('should stream tool call that is sent in one chunk', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[{"index":0,"id":"call_O17Uplv4lJvD6DVdIvFFeRMw","type":"function","function":{"name":"test-tool","arguments":"{\\"value\\":\\"Sparkle Day\\"}"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[],"usage":{"prompt_tokens":53,"completion_tokens":17,"total_tokens":70}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      tools: [
        {
          type: 'function',
          name: 'test-tool',
          inputSchema: {
            type: 'object',
            properties: { value: { type: 'string' } },
            required: ['value'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);
    expect(elements).toStrictEqual([
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0125',
      },
      {
        type: 'tool-input-start',
        id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
        toolName: 'test-tool',
      },
      {
        type: 'tool-input-delta',
        id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
        delta: '{"value":"Sparkle Day"}',
      },
      {
        type: 'tool-input-end',
        id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
      },
      {
        type: 'tool-call',
        toolCallId: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
        toolName: 'test-tool',
        input: '{"value":"Sparkle Day"}',
      },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0125',
      },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0125',
      },
      {
        type: 'finish',
        finishReason: 'tool-calls',
        providerMetadata: {
          openrouter: {
            usage: {
              completionTokens: 17,
              promptTokens: 53,
              totalTokens: 70,
              cost: undefined,
            },
          },
        },
        usage: {
          inputTokens: 53,
          outputTokens: 17,
          totalTokens: 70,
          reasoningTokens: Number.NaN,
          cachedInputTokens: Number.NaN,
        },
      },
    ]);
  });

  it('should handle error stream parts', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"error":{"message": "The server had an error processing your request. Sorry about that! You can retry your request, or contact us through our ` +
          `help center at help.openrouter.com if you keep seeing this error.","type":"server_error","param":null,"code":null}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    expect(await convertReadableStreamToArray(stream)).toStrictEqual([
      {
        type: 'error',
        error: {
          message:
            'The server had an error processing your request. Sorry about that! ' +
            'You can retry your request, or contact us through our help center at ' +
            'help.openrouter.com if you keep seeing this error.',
          type: 'server_error',
          code: null,
          param: null,
        },
      },
      {
        finishReason: 'error',
        providerMetadata: {
          openrouter: {
            usage: {},
          },
        },
        type: 'finish',
        usage: {
          inputTokens: Number.NaN,
          outputTokens: Number.NaN,
          totalTokens: Number.NaN,
          reasoningTokens: Number.NaN,
          cachedInputTokens: Number.NaN,
        },
      },
    ]);
  });

  it('should handle unparsable stream parts', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: ['data: {unparsable}\n\n', 'data: [DONE]\n\n'],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    expect(elements.length).toBe(2);
    expect(elements[0]?.type).toBe('error');
    expect(elements[1]).toStrictEqual({
      finishReason: 'error',

      type: 'finish',
      providerMetadata: {
        openrouter: {
          usage: {},
        },
      },
      usage: {
        inputTokens: Number.NaN,
        outputTokens: Number.NaN,
        totalTokens: Number.NaN,
        reasoningTokens: Number.NaN,
        cachedInputTokens: Number.NaN,
      },
    });
  });

  it('should pass the messages and the model', async () => {
    prepareStreamResponse({ content: [] });

    await model.doStream({
      prompt: TEST_PROMPT,
    });

    expect(await server.calls[0]!.requestBodyJson).toStrictEqual({
      stream: true,
      stream_options: { include_usage: true },
      model: 'anthropic/claude-3.5-sonnet',
      messages: [{ role: 'user', content: 'Hello' }],
    });
  });

  it('should pass headers', async () => {
    prepareStreamResponse({ content: [] });

    const provider = createOpenRouter({
      apiKey: 'test-api-key',
      headers: {
        'Custom-Provider-Header': 'provider-header-value',
      },
    });

    await provider.chat('openai/gpt-3.5-turbo').doStream({
      prompt: TEST_PROMPT,
      headers: {
        'Custom-Request-Header': 'request-header-value',
      },
    });

    const requestHeaders = server.calls[0]!.requestHeaders;

    expect(requestHeaders).toStrictEqual({
      authorization: 'Bearer test-api-key',
      'content-type': 'application/json',
      'custom-provider-header': 'provider-header-value',
      'custom-request-header': 'request-header-value',
    });
  });

  it('should pass extra body', async () => {
    prepareStreamResponse({ content: [] });

    const provider = createOpenRouter({
      apiKey: 'test-api-key',
      extraBody: {
        custom_field: 'custom_value',
        providers: {
          anthropic: {
            custom_field: 'custom_value',
          },
        },
      },
    });

    await provider.chat('anthropic/claude-3.5-sonnet').doStream({
      prompt: TEST_PROMPT,
    });

    const requestBody = await server.calls[0]!.requestBodyJson;

    expect(requestBody).toHaveProperty('custom_field', 'custom_value');
    expect(requestBody).toHaveProperty(
      'providers.anthropic.custom_field',
      'custom_value',
    );
  });
});
