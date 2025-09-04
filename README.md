# 🔗 React URL Shortener (Frontend Only)

A **frontend-only** URL shortener built with **React**.  
This project demonstrates client-side link shortening, redirection, and statistics tracking using `localStorage` for persistence.  
⚡ No backend or database is required — everything runs in the browser.

---

## ✨ Features

- **Shorten up to 5 URLs at once**  
  - Provide the original long URL.  
  - Optionally set a validity period (in minutes).  
  - Optionally choose a custom shortcode.  
  - Defaults to **30 minutes** if not specified.  

- **Unique Shortcodes**  
  - Automatically generated if none provided.  
  - Validated for alphanumeric format & uniqueness.  

- **Redirect Handling**  
  - Visiting `/r/:shortcode` redirects to the original URL.  
  - Each redirect records a click with timestamp, referrer, and coarse location.  

- **Statistics Dashboard**  
  - View all shortened URLs created in the current browser.  
  - Includes creation/expiry times, click counts, and click details.  

- **Logging Middleware**  
  - Custom localStorage-based logging (no `console.log`).  
  - Keeps the last 200 log entries.  

---

## 🛠️ Tech Stack

- [React 18](https://reactjs.org/)  
- [React Router 6](https://reactrouter.com/)  
- LocalStorage (for persistence & logging)  
- Fetch API (for location lookup)  

---

## 🚀 Getting Started

### Prerequisites
- Node.js (>= 16 recommended)  
- npm or yarn  

### Installation

1. Clone the repo:
   ```bash
   git clone https://github.com/your-username/url-shortener-frontend.git
   cd url-shortener-frontend
