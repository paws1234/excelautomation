<template>
  <!-- eslint-disable -->
  <div class="file-upload-container">
    <h1>Upload and Process Excel File</h1>

    <form @submit.prevent="handleFileUpload">
      <div class="file-input">
        <label for="file">Choose an Excel file:</label>
        <input type="file" id="file" ref="fileInput" accept=".xlsx" required />
      </div>

      <button type="submit" :disabled="isUploading">Upload and Process File</button>
    </form>

    <div v-if="isUploading" class="progress-container">
      <label>Uploading...</label>
      <div class="progress" :style="{ width: uploadProgress + '%' }"></div>
    </div>

    <div v-if="downloadUrl" class="download-link">
      <a :href="downloadUrl" download="processed.xlsx" class="btn-download">Download Processed File</a>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  data() {
    return {
      file: null,
      isUploading: false,
      uploadProgress: 0,
      downloadUrl: null
    };
  },
  methods: {
    handleFileUpload() {
      const fileInput = this.$refs.fileInput;
      if (!fileInput.files[0]) return;

      this.file = fileInput.files[0];
      const formData = new FormData();
      formData.append("file", this.file);

      this.isUploading = true;

      axios.post("https://excelautomation-xy7r.onrender.com/upload?limit=3", formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.lengthComputable) {
            this.uploadProgress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          }
        }
      })
      .then(response => {
        this.downloadUrl = "https://excelautomation-xy7r.onrender.com/" + response.data.fileName;
        this.isUploading = false;
      })
      .catch(error => {
        // eslint-disable-next-line no-console
        console.error("Error uploading file:", error);
        this.isUploading = false;
      });
    }
  }
};
</script>

<style scoped>
.file-upload-container {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.1);
}

h1 {
  text-align: center;
  color: #333;
}

.file-input {
  margin-bottom: 20px;
}

button {
  background-color: #007bff;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  width: 100%;
  font-size: 16px;
}

button:disabled {
  background-color: #aaa;
  cursor: not-allowed;
}

button:hover {
  background-color: #0056b3;
}

.progress-container {
  margin-top: 20px;
}

.progress {
  width: 0%;
  height: 20px;
  background-color: #28a745;
  border-radius: 5px;
}

.download-link {
  margin-top: 20px;
  text-align: center;
}

.btn-download {
  background-color: #28a745;
  color: white;
  padding: 10px 20px;
  border-radius: 5px;
  text-decoration: none;
  font-size: 16px;
}

.btn-download:hover {
  background-color: #218838;
}
</style>
