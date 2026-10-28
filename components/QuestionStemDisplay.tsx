/* eslint-disable @next/next/no-img-element */
import React, { useState } from 'react';
import { parseQuestionStem } from '@/lib/questionStemParser';
import { Image as ImageIcon, ZoomIn, X } from 'lucide-react';

interface QuestionStemDisplayProps {
  text?: string | null;
  className?: string;
  imageClassName?: string;
  showImages?: boolean;
}

export default function QuestionStemDisplay({
  text,
  className = 'text-xs sm:text-sm leading-relaxed',
  imageClassName = '',
  showImages = true,
}: QuestionStemDisplayProps) {
  const { cleanText, imageUrls } = parseQuestionStem(text);
  const [modalImage, setModalImage] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <p className={`whitespace-pre-line ${className}`}>
        {cleanText}
      </p>

      {showImages && imageUrls.length > 0 && (
        <div className="flex flex-wrap gap-3 pt-1">
          {imageUrls.map((src, idx) => (
            <div
              key={idx}
              className="group relative rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-1.5 shadow-xs transition-all hover:border-blue-400 dark:hover:border-blue-500"
            >
              <div className="relative overflow-hidden rounded-lg max-w-[280px] sm:max-w-xs">
                <img
                  src={src}
                  alt={`Clinical Image ${imageUrls.length > 1 ? idx + 1 : ''}`}
                  className={`h-auto max-h-48 w-full object-contain rounded-lg cursor-zoom-in group-hover:scale-[1.02] transition-transform ${imageClassName}`}
                  loading="lazy"
                  onClick={(e) => {
                    e.stopPropagation();
                    setModalImage(src);
                  }}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setModalImage(src);
                  }}
                  className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-slate-900/80 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-xs opacity-80 group-hover:opacity-100 transition-opacity"
                  title="Click to zoom image"
                >
                  <ZoomIn className="w-3 h-3" />
                  <span>Zoom</span>
                </button>
              </div>
              <div className="mt-1 flex items-center gap-1 px-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <ImageIcon className="w-3 h-3" />
                <span>Clinical Image {imageUrls.length > 1 ? `#${idx + 1}` : ''}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {modalImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            e.stopPropagation();
            setModalImage(null);
          }}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-2xl bg-white dark:bg-slate-900 p-2 shadow-2xl border border-slate-200 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setModalImage(null)}
              className="absolute top-4 right-4 z-10 rounded-full bg-slate-900/70 p-2 text-white hover:bg-slate-900 transition-colors shadow-md"
              title="Close image view"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={modalImage}
              alt="Clinical Image Full Resolution"
              className="max-h-[85vh] w-auto max-w-full rounded-xl object-contain mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
}
