import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Library from './screens/Library';
import Tutorial from './screens/Tutorial';
import TemplateEditor from './screens/TemplateEditor';
import GameSetup from './screens/GameSetup';
import Gameplay from './screens/Gameplay';
import Finale from './screens/Finale';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Library />} />
        <Route path="/tutorial" element={<Tutorial />} />
        <Route path="/edit/:id" element={<TemplateEditor />} />
        <Route path="/edit/new" element={<TemplateEditor />} />
        <Route path="/setup/:id" element={<GameSetup />} />
        <Route path="/play" element={<Gameplay />} />
        <Route path="/finale" element={<Finale />} />
      </Routes>
    </BrowserRouter>
  );
}
