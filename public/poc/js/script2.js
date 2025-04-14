console.log('Environment Variable: window.ENV_NAV_URL:', window.ENV_NAV_URL);

document.getElementById('uploadForm').addEventListener('submit', async function (event) {
  event.preventDefault();

  const fileInput = document.getElementById('fileInput');
  const statusDiv = document.getElementById('status');
  const file = fileInput.files[0];

  if (!file) {
    alert('No file selected');
    return;
  }

  const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
  statusDiv.innerHTML = `Selected file: ${fileSizeMB} MB. Sending to server...`;

  const formData = new FormData();
  formData.append('file', file);


  try {
    const uploadResponse = await fetch(`${window.ENV_NAV_URL}/poc4/convert`, {
      method: 'POST',
      body: formData
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw { status: uploadResponse.status, message: errorText };
    }

    const { taskId } = await uploadResponse.json();
    statusDiv.innerHTML = `File received by server (${fileSizeMB} MB). Queued...`;

    const pollStatus = async () => {
      const statusResponse = await fetch(`${window.ENV_NAV_URL}/poc4/status/${taskId}`);
      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        throw { status: statusResponse.status, message: errorText };
      }

      const { status, progress } = await statusResponse.json();

      if (status === 'error') {
        throw { status: 500, message: 'Server error during processing' };
      }

      statusDiv.innerHTML = `File (${fileSizeMB} MB): ${status} (${progress}%)`;

      if (status === 'completed') {
        const downloadUrl = `${window.ENV_NAV_URL}/poc4/download/${taskId}`;
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = 'converted.mp3';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        statusDiv.innerHTML = 'Download complete!';
      } else {
        setTimeout(pollStatus, 1000); // Poll every 1 second
      }
    };

    pollStatus();
  } catch (error) {
    alert(`Error ${error.status || 'Unknown'}: ${error.message || 'Something went wrong'}`);
    statusDiv.innerHTML = '';
  }
});