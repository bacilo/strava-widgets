/** Garmin's FIT SDK ships no TypeScript types. Minimal surface used here. */
declare module '@garmin/fitsdk' {
  export class Stream {
    static fromBuffer(buffer: Buffer): Stream;
  }
  export class Decoder {
    constructor(stream: Stream);
    isFIT(): boolean;
    checkIntegrity(): boolean;
    read(): {
      messages: {
        sessionMesgs?: Array<{ startTime?: Date; [key: string]: unknown }>;
        recordMesgs?: Array<{
          timestamp?: Date;
          positionLat?: number;
          positionLong?: number;
          [key: string]: unknown;
        }>;
        [key: string]: unknown;
      };
      errors: unknown[];
    };
  }
}
