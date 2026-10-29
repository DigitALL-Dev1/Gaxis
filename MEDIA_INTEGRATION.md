# Media Integration

## Screens

- Media Library (`/media`) lists media permitted for the signed-in user. Hosted audio/video streams use protected rendition URLs, resume a saved playback session and report playback events. Video can load reviewed WebVTT captions; transcripts are available separately.
- Media preparers and releasers can inspect processing jobs, retry failed processing, and submit human-corrected WebVTT and transcript content before release.
- Prepare Media (`/admin/media/prepare`) creates a controlled document and media version for an assigned active family owner, or selects an existing hosted media item to prepare a new version. The existing document release queue performs independent approval; processing and required caption review must be complete before release.
- HTTPS reference-only items open externally. They do not have hosted playback evidence or acknowledgement eligibility.

## API routes

All requests use the existing cookie-authenticated Lumen session and `/api/v1/lumen` prefix.

| Method | Path | Frontend behavior |
| ------ | ---- | ----------------- |
| POST | `/media/prepare` | Upload a video/audio file or submit an HTTPS reference-only item |
| GET | `/media` | List media the user may play or manage |
| GET | `/media/{id}` | Read authorized media metadata |
| GET | `/media/{id}/processing-status` | Inspect jobs and required human caption review |
| POST | `/media/{id}/process` | Retry eligible processing |
| POST | `/media/{id}/captions/review` | Save corrected WebVTT and transcript |
| GET | `/media/{id}/captions` | Load captions or a caption draft |
| GET | `/media/{id}/transcript` | Load transcript text |
| GET | `/media/{id}/renditions` | Choose protected playback streams |
| GET | `/media/{id}/stream?quality=...` | Stream the selected rendition |
| POST | `/media/{id}/playback/start` | Start or resume playback |
| POST | `/media/playback/{session_id}/progress` | Record play, heartbeat, pause, seek and end events |
| POST | `/media/playback/{session_id}/close` | Close the playback session |

## Permissions and evidence

- `documents.prepare` can prepare media and manage items in the user's assigned families.
- `documents.read` can browse and play currently approved media when the backend's classification, reader-class, family and grant checks allow it.
- `documents.release` allows assigned releasers to manage their family's media and release versions through the existing review workflow.
- Backend media authorization checks the corresponding document permissions; it does not rely on menu visibility.
- The backend awards playback credit only for continuously played ranges and makes acknowledgement eligibility available after at least 90% unique playback when acknowledgement is required. Playback eligibility is not itself an acknowledgement.
- Captions and transcripts remain editable only before release and must be human-reviewed when required. Media streams and progress requests are reauthorized by the backend.

## Upload and runtime requirements

- Hosted videos are limited to 2 GiB; hosted audio is limited to 200 MiB. FFmpeg and ffprobe must be available to process files and create renditions.
- Set `MEDIA_STORAGE_DIR` to private persistent storage. The default is `./media_storage` relative to the backend process working directory.
- Whisper CLI and `WHISPER_BINARY`/`WHISPER_MODEL` are optional. Generated captions are drafts and never satisfy human review until corrected and saved.
- Licence evidence is required for licensed or permission-granted media. Reference-only content requires an HTTPS URL, no uploaded file and acknowledgement disabled.
- `POST /media/prepare` creates an `UNDER_REVIEW` document version. The media release validation hook requires completed processing, required renditions and human-reviewed captions before an authorised independent releaser can approve it.

## Verification

Frontend: `bun run test -- src/test/media-api.test.ts src/test/app-routing.test.tsx --pool=threads --maxWorkers=1`, `bunx tsc --noEmit`, and `bun run build`.
Backend permission contract: `python -m unittest discover -s tests -p test_user_sessions.py`.
