import React from 'react';
import { X, Sparkles, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown'; // Actually we'll just format basic text for simplicity since we can't add more deps

interface AnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  content: string;
}

const AnalysisModal: React.FC<AnalysisModalProps> = ({ isOpen, onClose, loading, content }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-gradient-to-r from-purple-50 to-white">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Analyse IA du Projet
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
              <p className="text-gray-500 animate-pulse">L'IA analyse vos métrés...</p>
            </div>
          ) : (
             <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-line">
               {/* Simple render of the markdown/text content */}
               {content ? content : (
                   <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-4 rounded-lg">
                       <AlertCircle className="w-5 h-5" />
                       <p>Aucune donnée reçue. Avez-vous dessiné des formes ?</p>
                   </div>
               )}
             </div>
          )}
        </div>
        
        <div className="p-4 border-t bg-gray-50 text-xs text-gray-500 text-center">
            Les estimations sont fournies à titre indicatif par Gemini 2.5 Flash. Vérifiez toujours avec un professionnel.
        </div>
      </div>
    </div>
  );
};

export default AnalysisModal;