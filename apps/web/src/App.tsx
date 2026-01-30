import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Pages (to be implemented)
// import { ChatPage } from './pages/Chat';
// import { LoginPage } from './pages/Login';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background text-foreground">
        <Routes>
          <Route
            path="/"
            element={
              <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                  <h1 className="text-4xl font-bold mb-4">Manus Agent</h1>
                  <p className="text-muted-foreground mb-8">
                    AI-powered autonomous agent for complex tasks
                  </p>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>API Status: <span className="text-green-500">Ready</span></p>
                    <p>Start building the UI components...</p>
                  </div>
                </div>
              </div>
            }
          />
          {/* Add more routes as pages are implemented */}
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
