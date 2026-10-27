declare module "mammoth" {
  export interface MammothMessage {
    type: string
    message: string
  }

  export interface MammothResult {
    value: string
    messages: MammothMessage[]
  }

  export interface ExtractRawTextInput {
    buffer?: Buffer
    path?: string
  }

  export function extractRawText(input: ExtractRawTextInput): Promise<MammothResult>
}
