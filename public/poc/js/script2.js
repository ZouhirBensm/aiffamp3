document.getElementById('uploadForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    const fileInput = document.getElementById('fileInput');
    const statusDiv = document.getElementById('status');
    const file = fileInput.files[0];

    if (!file) {
        alert('No file selected');
        return;
    }

    // Show file size in MB
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    statusDiv.innerHTML = `Selected file: ${fileSizeMB} MB. Sending to server...`;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('http://localhost:3007/poc/convert', {
            method: 'POST',
            body: formData
        });

        // Update status once server receives the request
        statusDiv.innerHTML = `File received by server (${fileSizeMB} MB). Processing...`;

        if (!response.ok) {
            const errorText = await response.text();
            throw { status: response.status, message: errorText };
        }

        // Handle successful response (file download)
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'converted.mp3';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        // Clear status after success
        statusDiv.innerHTML = 'Download complete!';
    } catch (error) {
        // Display error code and message in an alert
        alert(`Error ${error.status || 'Unknown'}: ${error.message || 'Something went wrong'}`);
        statusDiv.innerHTML = '';
    }
});