# Transcription Service

Speech-to-text conversion for video content.

## What Goes Here

- Audio extraction from video files
- Transcription API integration (Whisper, AssemblyAI, Google Speech-to-Text)
- Subtitle generation (SRT, VTT formats)
- Speaker diarization
- Timestamp alignment

## Workflow

1. Extract audio track from video
2. Send audio to transcription service
3. Process transcription results
4. Store with timestamps
5. Generate subtitle files if needed

## Files Example

- `audioExtractor.ts` - Extract audio from video
- `transcriptionClient.ts` - API integration
- `subtitleGenerator.ts` - Create subtitle files
- `transcriptionProcessor.ts` - Process and format results
