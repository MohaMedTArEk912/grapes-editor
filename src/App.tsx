import { LogicProvider } from './context/LogicContext';
import { Editor } from './components/Editor';

function App() {
    return (
        <LogicProvider>
            <Editor />
        </LogicProvider>
    );
}

export default App;
