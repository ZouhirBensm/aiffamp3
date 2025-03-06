# aifctomp3

This project is a Node.js application designed to serve an HTML page and handle audio-related tasks, specifically serving `.aifc` audio files and converting them to `.mp3`. The app is hosted on **Linode**.

The app is available in render at:  
[https://aifcamp3.com/](https://aifcamp3.com/)

## Features

- **Express.js** to handle HTTP requests and serve static files.
- Serves a simple `index.html` at the root endpoint (`/`).
- The app is deployed on **Linode**.

## Table of Contents

- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Running the App Locally](#running-the-app-locally)
- [Deployment to Linode](#deployment-to-linode)
- [Graceful Shutdown](#graceful-shutdown)
- [Render Setup](#render-setup)

## Installation

1. Clone this repository:

    ```bash
    git clone https://github.com/your-username/aifcamp3.git
    cd aifcamp3
    ```

2. Install the dependencies:

    ```bash
    npm install
    ```

3. Create a `.env` file in the root directory and add the following (if not already done):

    ```
    PORT=3007
    ```

## Environment Variables

- `PORT`: The port on which the app will listen.

## Running the App Locally

1. Set your environment variables in a `.env` file.

2. To run the app in development mode locally, execute:

    ```bash
    npm run dev
    ```

    This will start the server on the specified `PORT`. The command triggers the following:

    ```bash
    nodemon aifcamp3.js
    ```

3. To run in **production mode**, set `NODE_ENV` to `production`:

    ```bash
    node aifcamp3.js
    ```