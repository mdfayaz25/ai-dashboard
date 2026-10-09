export interface GenerateOptions {
  model: string;
  system?: string;
  prompt: string;
  temperature: number;
  maxTokens: number;
  signal?: AbortSignal;
}

export interface GenerateResult {
  output: string;
  inputTokens: number;
  outputTokens: number;
  stopReason?: string;
}

export interface Provider {
  id: 'anthropic' | 'bedrock' | 'demo';
  label: string;
  available(): boolean;
  /** Streams text through onDelta and resolves with the full result and token usage. */
  stream(opts: GenerateOptions, onDelta: (text: string) => void): Promise<GenerateResult>;
}
