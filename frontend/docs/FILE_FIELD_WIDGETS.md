# File Field Widgets

This document describes the file field widget system that provides configurable file type filtering and an expandable interface similar to the image field widget.

## Components

### ExpandableFileField

The core component that provides the expandable interface for file selection with configurable file type filtering.

**Props:**
- `allowedFileTypes` (array): Categories of files to allow (`['image', 'document', 'video', 'audio']`)
- `allowedMimeTypes` (array): Specific MIME types to allow (more specific than categories)
- `allowedExtensions` (string): Comma-separated file extensions (e.g., '.pdf, .doc, .jpg')
- `fileTypeLabel` (string): Label used in UI text (default: 'File')
- `maxFileSize` (number): Maximum file size in MB
- `minFileSize` (number): Minimum file size in KB
- All standard form field props (value, onChange, validation, etc.)

### FileInput

General-purpose file input that accepts all file types by default.

```jsx
<FileInput
    label="Upload File"
    value={file}
    onChange={setFile}
    namespace="my-namespace"
    allowedFileTypes={['document', 'image']}
    multiple={true}
    maxItems={5}
/>
```

### Specialized Components

#### DocumentInput
Pre-configured for document files (PDF, Word, Excel, PowerPoint, text files).

```jsx
<DocumentInput
    label="Upload Document"
    value={document}
    onChange={setDocument}
    namespace="my-namespace"
/>
```

#### VideoInput
Pre-configured for video files (MP4, WebM, AVI, MOV).

```jsx
<VideoInput
    label="Upload Video"
    value={video}
    onChange={setVideo}
    namespace="my-namespace"
/>
```

#### AudioInput
Pre-configured for audio files (MP3, WAV, OGG, AAC).

```jsx
<AudioInput
    label="Upload Audio"
    value={audio}
    onChange={setAudio}
    namespace="my-namespace"
/>
```

## Configuration Options

### File Type Categories

The system supports these predefined categories:

- **image**: JPEG, PNG, GIF, WebP, SVG
- **document**: PDF, Word, Excel, PowerPoint, text files, CSV
- **video**: MP4, WebM, OGG, AVI, MOV
- **audio**: MP3, WAV, OGG, AAC

### Advanced Configuration Options

#### Custom MIME Type Filtering

For more specific control, use `allowedMimeTypes`:

```jsx
<FileInput
    label="PDF Only"
    allowedMimeTypes={['application/pdf']}
    fileTypeLabel="PDF Document"
    // ... other props
/>
```

#### File Extension Filtering

Restrict files by specific extensions:

```jsx
<FileInput
    label="Office Documents"
    allowedExtensions=".pdf, .doc, .docx, .xls, .xlsx"
    fileTypeLabel="Office Document"
    // ... other props
/>
```

#### File Size Constraints

Set minimum and maximum file sizes:

```jsx
<FileInput
    label="Profile Image"
    allowedFileTypes={['image']}
    maxFileSize={5} // 5MB maximum
    minFileSize={50} // 50KB minimum
    fileTypeLabel="Profile Image"
    // ... other props
/>
```

### Multiple File Selection

Enable multiple file selection with limits:

```jsx
<FileInput
    label="Multiple Files"
    multiple={true}
    maxItems={10}
    minItems={1}
    // ... other props
/>
```

## Features

1. **Expandable Interface**: Similar to the image field widget with inline expansion
2. **Advanced File Filtering**: Multiple layers of file type restrictions
   - Category-based filtering (document, image, video, audio)
   - MIME type filtering for precise control
   - File extension filtering for additional security
3. **File Size Validation**: Configurable minimum and maximum file size limits
4. **Comprehensive Validation**: Real-time validation with detailed error messages
5. **File Type Icons**: Different icons and colors for different file types
6. **Drag & Drop Upload**: Supports drag and drop with comprehensive validation
7. **Search Integration**: Full search capabilities with the media library
8. **Grid/List View**: Toggle between grid and list views
9. **Pagination**: Handles large numbers of files with pagination
10. **Upload & Approval**: Direct upload with tag-based approval workflow

## File Type Icons

The system automatically displays appropriate icons based on file type:

- **Documents**: Blue file text icon
- **Images**: Green image icon (with thumbnails when available)
- **Videos**: Purple video icon
- **Audio**: Orange audio icon
- **Unknown**: Gray generic file icon

## Integration

The file field widgets are automatically available through the form field registry and can be used in:

- Dynamic form renderers
- Schema-driven forms
- Custom form implementations

## Example Usage

```jsx
import { FileInput, DocumentInput, VideoInput, AudioInput } from '../form-fields'

function MyForm() {
    const [files, setFiles] = useState({
        anyFile: null,
        documents: [],
        video: null,
        audio: null
    })

    return (
        <div>
            <FileInput
                label="Any File"
                value={files.anyFile}
                onChange={(file) => setFiles(prev => ({ ...prev, anyFile: file }))}
                namespace="my-app"
            />
            
            <DocumentInput
                label="Documents"
                value={files.documents}
                onChange={(docs) => setFiles(prev => ({ ...prev, documents: docs }))}
                namespace="my-app"
                multiple
                maxItems={5}
            />
            
            <VideoInput
                label="Video File"
                value={files.video}
                onChange={(video) => setFiles(prev => ({ ...prev, video }))}
                namespace="my-app"
            />
            
            <AudioInput
                label="Audio File"
                value={files.audio}
                onChange={(audio) => setFiles(prev => ({ ...prev, audio }))}
                namespace="my-app"
            />
        </div>
    )
}
```

## Demo Component

A complete demo is available in `FileFieldDemo.jsx` that showcases all the features and configuration options.
