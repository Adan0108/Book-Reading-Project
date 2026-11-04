import { useEffect, useRef, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { localImage, releaseImage, validateImage, MAX_PAGES, type EditorImage } from './images';

function ImageCard({ image, index, count, disabled, move, remove, replace }: {
  image: EditorImage; index: number; count: number; disabled: boolean;
  move: (from: number, to: number) => void; remove: () => void; replace: (files: File[]) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image.id, disabled });
  return <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }} className="rounded-xl border p-3 bg-base-200">
    <div className="flex justify-between items-center mb-2"><strong>Page {index + 1}</strong>
      <button type="button" {...attributes} {...listeners} disabled={disabled} aria-label={`Drag page ${index + 1}`} className="btn btn-sm touch-none">↕ Drag</button></div>
    <img src={image.previewUrl} alt={`Page ${index + 1} preview`} loading={index === 0 ? 'eager' : 'lazy'} decoding="async" className="w-full h-56 object-contain" />
    <p className="text-sm break-words">{image.file?.name ?? 'Saved image'} · {image.status}</p>
    {image.error && <p role="alert" className="text-error">{image.error}</p>}
    <div className="flex flex-wrap gap-2 mt-2">
      <button type="button" className="btn btn-sm" disabled={disabled || index === 0} onClick={() => move(index, index - 1)} aria-label={`Move page ${index + 1} up`}>↑</button>
      <button type="button" className="btn btn-sm" disabled={disabled || index === count - 1} onClick={() => move(index, index + 1)} aria-label={`Move page ${index + 1} down`}>↓</button>
      <label className="btn btn-sm">Replace<input type="file" aria-label={`Replace page ${index + 1}`} accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={disabled} onChange={e => { replace(Array.from(e.target.files ?? [])); e.target.value = ''; }} /></label>
      <button type="button" className="btn btn-sm" disabled={disabled} onClick={remove} aria-label={`Remove page ${index + 1}`}>Remove</button>
    </div>
  </article>;
}

export function ImageEditor({ images, onChange, disabled = false, cover = false }: {
  images: EditorImage[]; onChange: (images: EditorImage[]) => void; disabled?: boolean; cover?: boolean;
}) {
  const [errors, setErrors] = useState<string[]>([]);
  const latest = useRef(images);
  useEffect(() => { latest.current = images; }, [images]);
  useEffect(() => () => latest.current.forEach(releaseImage), []);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  function select(files: File[], replaceIndex?: number) {
    if (disabled) return;
    const invalid = files.map(validateImage).filter((e): e is string => !!e);
    if ((replaceIndex !== undefined || cover) && files.length !== 1) invalid.push('Choose one image to replace this image.');
    if (!cover && replaceIndex === undefined && images.length + files.length > MAX_PAGES) invalid.push('A chapter can have at most 100 images.');
    setErrors(invalid); if (invalid.length) return;
    if (!files.length) return;
    if (cover) { images.forEach(releaseImage); onChange([localImage(files[0])]); }
    else if (replaceIndex !== undefined) { releaseImage(images[replaceIndex]); onChange(images.map((i, n) => n === replaceIndex ? localImage(files[0]) : i)); }
    else onChange([...images, ...files.map(localImage)]);
  }
  function move(from: number, to: number) { onChange(arrayMove(images, from, to)); }
  return <section aria-label={cover ? 'Book cover' : 'Chapter images'} className="my-6">
    <h2 className="text-xl font-bold mb-3">{cover ? 'Book cover' : `Chapter pages (${images.length} / ${MAX_PAGES})`}</h2>
    <div className="border-2 border-dashed rounded-xl p-6 text-center mb-4" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); select(Array.from(e.dataTransfer.files)); }}>
      <label className="btn">{cover ? 'Choose cover' : 'Add images'}<input aria-label={cover ? 'Choose cover' : 'Add chapter images'} type="file" multiple={!cover} accept="image/jpeg,image/png,image/webp" disabled={disabled} className="sr-only" onChange={e => { select(Array.from(e.target.files ?? [])); e.target.value = ''; }} /></label>
      <p className="mt-2">Or drag {cover ? 'an image' : 'images'} here. JPEG, PNG, WebP · up to 10 MB each.</p>
      <p className="text-sm">Images stay on this device until you save or publish.</p>
    </div>
    {errors.length > 0 && <div role="alert" className="text-error">{errors.map((e, i) => <p key={i}>{e}</p>)}</div>}
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
      if (!disabled && over && active.id !== over.id) move(images.findIndex(i => i.id === active.id), images.findIndex(i => i.id === over.id));
    }}><SortableContext items={images.map(i => i.id)} strategy={rectSortingStrategy}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{images.map((image, index) => <ImageCard key={image.id} image={image} index={index} count={images.length} disabled={disabled} move={move}
        remove={() => { releaseImage(image); onChange(images.filter(i => i.id !== image.id)); }} replace={files => select(files, index)} />)}</div>
    </SortableContext></DndContext>
  </section>;
}
