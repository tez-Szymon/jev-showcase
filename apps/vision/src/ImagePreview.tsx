import { useEffect, useRef, useState } from 'react';
import { Crosshair } from 'lucide-react';
import type { Box, Photo } from './types';

export function ImagePreview({ photo, box }: { photo: Photo; box?: Box }) {
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  const scale = Math.min(size.width / photo.width, size.height / photo.height);
  return <div className="image-preview" ref={container}>
    <div className="image-fit" style={{ width: photo.width * scale, height: photo.height * scale }}>
      <img src={photo.dataUrl} alt={`Przesłany obraz: ${photo.name}`} />
      {box && <div className="bounding-box" data-testid="bounding-box" style={{ left: `${box.left * 100}%`, top: `${box.top * 100}%`, width: `${(box.right - box.left) * 100}%`, height: `${(box.bottom - box.top) * 100}%` }}>
        <span className="box-label"><Crosshair size={11} /> Jev · box</span>
        <i /><i /><i /><i />
      </div>}
    </div>
  </div>;
}
