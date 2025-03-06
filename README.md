# aifctomp3

This project is a Node.js application designed to serve an HTML page and handle audio-related tasks, specifically serving `.aifc` audio files and converting them to `.mp3`. The app is hosted on **Render.com** using the free plan.

The app is available in render at:  
[https://aifctomp3.onrender.com/](https://aifctomp3.onrender.com/)

## Features

- **Express.js** to handle HTTP requests and serve static files.
- Serves a simple `index.html` at the root endpoint (`/`).
- The app is deployed on **Render.com** using the free plan.

## Table of Contents

- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Running the App Locally](#running-the-app-locally)
- [Deployment to Render](#deployment-to-render)
- [Graceful Shutdown](#graceful-shutdown)
- [Render Setup](#render-setup)

## Installation

1. Clone this repository:

    ```bash
    git clone https://github.com/your-username/aifctomp3.git
    cd aifctomp3
    ```

2. Install the dependencies:

    ```bash
    npm install
    ```

3. Create a `.env` file in the root directory and add the following (if not already done):

    ```
    PORT=3000
    ```

## Environment Variables

- `PORT`: The port on which the app will listen. If not set, defaults to `3000`.

## Running the App Locally

1. Set your environment variables in a `.env` file.

2. To run the app in development mode locally, execute:

    ```bash
    npm run dev
    ```

    This will start the server on the specified `PORT`. The command triggers the following:

    ```bash
    nodemon aifctomp3.js
    ```

3. To run in **render mode**, set `NODE_ENV` to `render`:

    ```bash
    node aifctomp3.js
    ```

## Deployment to Render

This project is deployed on Render’s free plan. To deploy it:

1. **Create an Account on Render**:  
   Visit [Render.com](https://render.com) and sign up for an account.

2. **Connect your GitHub repository**:  
   In Render's dashboard, click on **New Web Service** and connect it to your GitHub repository.

3. **Set up the service**:  
   - Select **Node.js** as the environment.
   - Set the **Build Command** to `npm install`.
   - Set the **Start Command** to `node aifctomp3.js`.
   - Set the **ENV variables** to PORT=3000.

4. **Deploy the app**:  
   Once you connect your repository, Render will automatically deploy the app and set up a render environment.

5. After deployment, you can access the app at:  
   [https://aifctomp3.onrender.com/](https://aifctomp3.onrender.com/)

## Graceful Shutdown

The app includes graceful shutdown functionality, which ensures that the application shuts down cleanly when receiving termination signals (`SIGINT`, `SIGTERM`).

In `index.js`:

```javascript
const gracefulShutdown = () => {
  console.log('Closing the app gracefully...');
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);