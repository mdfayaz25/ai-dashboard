import { BedrockRuntimeClient, ConverseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import { env } from '../../config/env.js';
import type { Provider } from './types.js';

let client: BedrockRuntimeClient | null = null;
const getClient = () => (client ??= new BedrockRuntimeClient({ region: env.AWS_REGION }));

/** Uses the Bedrock Converse API, so any chat model enabled in your AWS account works the same way. */
export const bedrockProvider: Provider = {
  id: 'bedrock',
  label: 'AWS Bedrock',
  // Opt-in, so ambient AWS credentials on a machine are never used by accident.
  available: () => env.BEDROCK_ENABLED === 'true',
  async stream({ model, system, prompt, temperature, maxTokens, signal }, onDelta) {
    const res = await getClient().send(
      new ConverseStreamCommand({
        modelId: model,
        messages: [{ role: 'user', content: [{ text: prompt }] }],
        ...(system ? { system: [{ text: system }] } : {}),
        inferenceConfig: { maxTokens, temperature },
      }),
      { abortSignal: signal },
    );
    let output = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let stopReason: string | undefined;
    for await (const event of res.stream ?? []) {
      const text = event.contentBlockDelta?.delta?.text;
      if (text) {
        output += text;
        onDelta(text);
      }
      if (event.messageStop?.stopReason) stopReason = event.messageStop.stopReason;
      if (event.metadata?.usage) {
        inputTokens = event.metadata.usage.inputTokens ?? 0;
        outputTokens = event.metadata.usage.outputTokens ?? 0;
      }
    }
    return { output, inputTokens, outputTokens, stopReason };
  },
};
