console.log("Hello")

document.getElementById('uploadForm').addEventListener('submit', async function(event) {
  event.preventDefault();

  const fileInput = document.getElementById('fileInput');
  const statusDiv = document.getElementById('status');
  const file = fileInput.files[0];

  if (!file) {
      alert('No file selected');
      return;
  }

  // Display loading message
  statusDiv.innerHTML = 'Loading...';

  const formData = new FormData();
  formData.append('file', file);

  try {
      const response = await fetch('http://localhost:3007/poc/convert', {
          method: 'POST',
          body: formData
      });

      if (!response.ok) {
          const errorText = await response.text();
          throw { status: response.status, message: errorText };
      }

      // Handle successful response (file download)
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'converted.mp3'; // Default filename from your endpoint
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // Clear status after success
      statusDiv.innerHTML = '';
  } catch (error) {
      // Display error code and message in an alert
      alert(`Error ${error.status || 'Unknown'}: ${error.message || 'Something went wrong'}`);
      statusDiv.innerHTML = '';
  }
});