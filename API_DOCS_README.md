# 🚀 Tolstoy API Documentation

> **Fully-featured Swagger UI with Advanced Playground Testing Capabilities**

## 🌟 Features

### 🎯 **Advanced API Playground**
- **Interactive Testing**: Test all 54 endpoints directly from the browser
- **Real-time Responses**: Live API calls with detailed response handling
- **Multi-environment Support**: Production, Staging, Local, and Custom URLs
- **Smart Authentication**: Persistent credential management with auto-injection

### 🔐 **Comprehensive Authentication System**
- **Multi-tenant Headers**: Automatic `x-org-id` and `x-user-id` injection
- **Persistent Storage**: Credentials saved across browser sessions
- **Environment Variables**: Custom header and parameter management
- **Debug Mode**: Advanced request/response logging

### 📊 **Request History & Analytics**
- **Request Tracking**: Automatic history of all API calls (last 50)
- **Response Analytics**: Status codes, timing, and error tracking
- **Replay Functionality**: Quick access to previous requests
- **Export Capabilities**: Download request history

### 💻 **Code Generation**
- **Multi-language Examples**: cURL, JavaScript, Python, Go, Postman
- **Dynamic Generation**: Real-time code updates based on current endpoint
- **Copy-to-clipboard**: One-click code copying
- **Syntax Highlighting**: Professional code display

### 🎨 **Professional UI/UX**
- **Modern Design**: Gradient headers, professional styling
- **Responsive Layout**: Mobile-friendly design
- **Keyboard Shortcuts**: Power-user keyboard navigation
- **Status Notifications**: Real-time feedback system

## 🚀 Quick Start

### 1. **Start Documentation Server**
```bash
# Launch advanced documentation (primary)
npm run docs:serve              # → http://localhost:8080

# Launch basic Swagger UI (fallback)  
npm run docs:basic              # → Basic Swagger interface

# Regenerate OpenAPI spec
npm run docs:generate           # → Updates API specification
```

### 2. **Setup Authentication**
1. Open `http://localhost:8080/docs-advanced.html`
2. Click the **🔐 Authentication** tab
3. Enter your `Organization ID` and `User ID`
4. Click **💾 Save Credentials**

### 3. **Test Endpoints**
1. Browse to any endpoint in the Swagger UI
2. Click **"Try it out"**
3. Fill in parameters (auth headers auto-added)
4. Click **"Execute"**
5. View real-time results

## 📋 **Advanced Features Guide**

### 🔐 **Authentication Tab**
- **Organization Authentication**: Set up org-id and user-id
- **Base URL Configuration**: Switch between environments
- **Request Configuration**: Timeout and debug settings

### 🌍 **Environment Tab**
- **Custom Variables**: Add environment-specific variables
- **Header Injection**: Auto-inject custom headers (prefix with `HEADER_`)
- **Parameter Substitution**: Use variables in requests

### 📜 **Request History Tab**
- **Live History**: See all requests in real-time
- **Status Tracking**: Monitor success/failure rates
- **Quick Replay**: Click any historical request to view details
- **Clear History**: Reset tracking data

### 💡 **Code Examples Tab**
- **Language Selection**: Choose from 5+ code generation formats
- **Dynamic Updates**: Examples update based on selected endpoint
- **Copy Functionality**: One-click code copying
- **Syntax Highlighting**: Professional code formatting

## 🎯 **Testing Workflow**

### **Basic Testing**
1. **Select Endpoint**: Click any endpoint in Swagger UI
2. **Try It Out**: Click the "Try it out" button  
3. **Fill Parameters**: Enter required path/query parameters
4. **Execute**: Click "Execute" to make the API call
5. **View Results**: See formatted response with status codes

### **Advanced Testing**
1. **Set Environment**: Choose Production/Staging/Local from dropdown
2. **Configure Auth**: Set up persistent authentication credentials
3. **Add Variables**: Create environment variables for common values
4. **Enable Debug**: Turn on debug mode for detailed logging
5. **Test & Iterate**: Use request history to track and replay calls

### **Code Generation**
1. **Select Endpoint**: Choose any endpoint from the documentation
2. **Choose Language**: Pick from cURL, JS, Python, Go, or Postman
3. **Copy Code**: Use the copy button to get production-ready code
4. **Customize**: Modify the generated code for your specific needs

## 🛠️ **Development Commands**

```bash
# Documentation Management
npm run docs:serve              # Advanced Swagger UI with playground
npm run docs:basic              # Basic Swagger UI
npm run docs:generate           # Regenerate OpenAPI specification

# API Development
npm run build:docs              # Build app and generate OpenAPI spec
npm run start:dev               # Start development server
npm run start                   # Start production server
```

## 🎮 **Keyboard Shortcuts**

- **Ctrl/Cmd + K**: Focus on API filter search
- **Ctrl/Cmd + 1**: Switch to Authentication tab
- **Ctrl/Cmd + 2**: Switch to Environment tab  
- **Ctrl/Cmd + 3**: Switch to Request History tab
- **Ctrl/Cmd + 4**: Switch to Code Examples tab

## 📊 **Documentation Stats**

- **✅ 54 Interactive Endpoints**: Complete API coverage
- **🔐 Multi-tenant Authentication**: Enterprise-ready security
- **🌍 Multi-environment Support**: Production, staging, local testing
- **📱 Mobile Responsive**: Works on all device sizes
- **⚡ Real-time Testing**: Live API calls with instant feedback
- **📜 Request History**: Track up to 50 recent requests
- **💻 Code Generation**: 5 languages/tools supported

## 🔧 **Advanced Configuration**

### **Custom Environment Setup**
1. Go to **🌍 Environment** tab
2. Add variables like:
   - `API_KEY`: Your API key
   - `HEADER_Authorization`: Bearer token  
   - `TIMEOUT`: Custom timeout value
3. Use variables in requests automatically

### **Debug Mode**
- Enable in **🔐 Authentication** tab
- See detailed request/response logs in browser console
- Track headers, timing, and response data

### **Request Persistence**
- All credentials saved in localStorage
- Request history persists across sessions
- Environment variables maintained between visits

## 🚀 **Production Deployment**

The documentation is ready for production deployment:

1. **Static Hosting**: Deploy `docs-advanced.html` to any static host
2. **CDN Ready**: All assets properly referenced
3. **CORS Configured**: Works with your API endpoints
4. **Mobile Optimized**: Responsive design for all devices

## 🆘 **Troubleshooting**

### **Common Issues**

**Authentication Not Working?**
- Check org-id and user-id are properly set
- Verify credentials are saved (check localStorage)
- Enable debug mode to see request headers

**Requests Failing?**
- Verify base URL is correct for your environment  
- Check CORS settings on your API server
- Look for error details in browser console

**Code Examples Not Updating?**
- Ensure you've clicked on an endpoint first
- Check that OpenAPI spec loaded successfully
- Try refreshing the page

### **Support**
- **GitHub**: [Issues & Feature Requests](https://github.com/joosuhail12/tolstoy/issues)
- **Documentation**: Comprehensive guides included
- **Debug Mode**: Enable for detailed troubleshooting information

---

**🎉 Your fully-featured API documentation is now ready!** 

Visit `http://localhost:8080/docs-advanced.html` to explore all the advanced playground features.