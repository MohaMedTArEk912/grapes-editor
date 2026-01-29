import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LogicProvider } from './context/LogicContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Editor } from './components/Editor';
import { Login } from './pages/Auth/Login';
import { Register } from './pages/Auth/Register';

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
    const { isAuthenticated } = useAuth();
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }
    return children;
};

function App() {
    return (
        <Router>
            <AuthProvider>
                <LogicProvider>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        <Route
                            path="/"
                            element={
                                <ProtectedRoute>
                                    <Editor />
                                </ProtectedRoute>
                            }
                        />
                    </Routes>
                </LogicProvider>
            </AuthProvider>
        </Router>
    );
}

export default App;
