<?php
// Handle POST request for the upload
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');
    // Allow the app (and any browser-based admin tooling) to call this
    // cross-origin without being blocked.
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');

    if (!isset($_FILES['thumbnail']) || $_FILES['thumbnail']['error'] !== UPLOAD_ERR_OK) {
        echo json_encode(['success' => false, 'message' => 'No file uploaded or upload error']);
        exit;
    }

    $file = $_FILES['thumbnail'];

    // 8MB cap - InfinityFree free-tier accounts have limited storage/bandwidth,
    // and this also blocks abuse of the endpoint for huge uploads.
    $maxBytes = 8 * 1024 * 1024;
    if ($file['size'] > $maxBytes) {
        echo json_encode(['success' => false, 'message' => 'Image is too large. Max size is 8MB.']);
        exit;
    }

    // IMPORTANT: never trust the client-supplied MIME type or filename
    // extension to decide what gets saved - both are just strings the
    // caller sends and can be spoofed (e.g. a ".php" file relabelled with
    // a fake "image/jpeg" Content-Type and a ".jpg" name). getimagesize()
    // actually reads the file's binary header, so this only accepts real
    // image data, and we pick the saved extension ourselves from what it
    // detects rather than anything the client claimed.
    $imageInfo = @getimagesize($file['tmp_name']);
    $allowedImageTypes = [
        IMAGETYPE_JPEG => 'jpg',
        IMAGETYPE_PNG  => 'png',
        IMAGETYPE_GIF  => 'gif',
        IMAGETYPE_WEBP => 'webp',
    ];
    if ($imageInfo === false || !isset($allowedImageTypes[$imageInfo[2]])) {
        echo json_encode(['success' => false, 'message' => 'Invalid file. Only real JPG, PNG, GIF, and WEBP images are allowed.']);
        exit;
    }
    $ext = $allowedImageTypes[$imageInfo[2]];

    // Ensure the uploads directory exists
    $uploadDir = __DIR__ . '/uploads/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    // Defense in depth: even though we only ever write files with a safe,
    // server-chosen image extension, make sure this directory can never
    // execute a script if anything ever does end up in it.
    $htaccessPath = $uploadDir . '.htaccess';
    if (!file_exists($htaccessPath)) {
        file_put_contents($htaccessPath, "php_flag engine off\nAddHandler cgi-script .php .php3 .php4 .php5 .php7 .phtml .pl .py .cgi\nOptions -ExecCGI\n");
    }

    // Server-generated filename only - never derived from the client's
    // original filename, which closes off directory traversal / null-byte
    // style tricks too.
    $filename = 'thumb_' . time() . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
    $targetPath = $uploadDir . $filename;

    if (move_uploaded_file($file['tmp_name'], $targetPath)) {
        $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
        $domain = $_SERVER['HTTP_HOST'];
        $path = dirname($_SERVER['REQUEST_URI']);
        if ($path === '/' || $path === '\\') $path = '';

        $publicUrl = $protocol . '://' . $domain . $path . '/uploads/' . $filename;

        echo json_encode(['success' => true, 'url' => $publicUrl]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to move uploaded file']);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Upload Course Thumbnail</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0F172A; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; text-align: center; }
        .card { background: #1E293B; padding: 30px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); max-width: 400px; width: 100%; }
        h1 { margin-top: 0; font-size: 22px; color: #F8FAFC; }
        p { color: #94A3B8; font-size: 14px; margin-bottom: 24px; }
        .upload-area { border: 2px dashed #6366F1; border-radius: 12px; padding: 40px 20px; cursor: pointer; transition: 0.3s; margin-bottom: 20px; background: rgba(99, 102, 241, 0.05); }
        .upload-area:hover { background: rgba(99, 102, 241, 0.1); }
        .btn { background: #6366F1; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 16px; width: 100%; }
        .btn:disabled { background: #475569; cursor: not-allowed; }
        input[type="file"] { display: none; }
        .result { margin-top: 20px; display: none; text-align: left; background: #0F172A; padding: 15px; border-radius: 8px; border: 1px solid #334155; }
        .result-title { font-size: 12px; color: #10B981; font-weight: bold; margin-bottom: 8px; text-transform: uppercase; }
        .result-url { word-break: break-all; font-size: 13px; color: #94A3B8; margin-bottom: 15px; user-select: all; }
        .copy-btn { background: #10B981; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 14px; width: 100%; }
        #preview { max-width: 100%; max-height: 150px; margin-bottom: 15px; border-radius: 8px; display: none; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Upload Thumbnail</h1>
        <p>Select an image to get a public URL for your course.</p>
        
        <form id="uploadForm">
            <label class="upload-area" id="dropZone">
                <img id="preview" src="" alt="Preview">
                <div id="uploadText">Tap to select an image<br><small>(JPG, PNG, WEBP)</small></div>
                <input type="file" id="fileInput" name="thumbnail" accept="image/jpeg, image/png, image/webp, image/gif" required>
            </label>
            <button type="submit" class="btn" id="submitBtn" disabled>Upload Image</button>
        </form>

        <div class="result" id="resultBox">
            <div class="result-title">Upload Successful!</div>
            <div class="result-url" id="resultUrl"></div>
            <button class="copy-btn" id="copyBtn">Copy URL to Clipboard</button>
        </div>
    </div>

    <script>
        const fileInput = document.getElementById('fileInput');
        const submitBtn = document.getElementById('submitBtn');
        const uploadForm = document.getElementById('uploadForm');
        const preview = document.getElementById('preview');
        const uploadText = document.getElementById('uploadText');
        const resultBox = document.getElementById('resultBox');
        const resultUrl = document.getElementById('resultUrl');
        const copyBtn = document.getElementById('copyBtn');

        fileInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    preview.src = e.target.result;
                    preview.style.display = 'block';
                    uploadText.style.display = 'none';
                    submitBtn.disabled = false;
                }
                reader.readAsDataURL(this.files[0]);
            }
        });

        uploadForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            if (!fileInput.files[0]) return;
            
            submitBtn.disabled = true;
            submitBtn.textContent = 'Uploading...';
            
            const formData = new FormData();
            formData.append('thumbnail', fileInput.files[0]);

            try {
                const response = await fetch('', { method: 'POST', body: formData });
                const data = await response.json();
                
                if (data.success) {
                    resultBox.style.display = 'block';
                    resultUrl.textContent = data.url;
                    uploadForm.style.display = 'none';
                } else {
                    alert('Error: ' + data.message);
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Upload Image';
                }
            } catch (err) {
                alert('Upload failed. Please try again.');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Upload Image';
            }
        });

        copyBtn.addEventListener('click', function() {
            navigator.clipboard.writeText(resultUrl.textContent).then(() => {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = 'Copied!';
                copyBtn.style.background = '#059669';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                    copyBtn.style.background = '#10B981';
                }, 2000);
            });
        });
    </script>
</body>
</html>
