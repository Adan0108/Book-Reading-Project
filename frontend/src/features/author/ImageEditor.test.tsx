import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageEditor } from './ImageEditor';
import type { EditorImage } from './images';

function Harness() { const [images, setImages] = useState<EditorImage[]>([]); return <ImageEditor images={images} onChange={setImages} />; }
const file = (name: string) => new File(['image'], name, { type: 'image/png' });
describe('local chapter image editor', () => {
  beforeEach(() => vi.clearAllMocks());
  it('selects multiple images without network requests, numbers pages, reorders, replaces and removes', async () => {
    const user = userEvent.setup();
    const network = vi.spyOn(window, 'fetch');
    render(<Harness />);
    await user.upload(screen.getByLabelText('Add chapter images'), [file('one.png'), file('two.png')]);
    expect(screen.getByText('Chapter pages (2 / 100)')).toBeInTheDocument();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole('button', { name: 'Move page 2 up' }));
    expect(within(screen.getAllByRole('article')[0]).getByText(/two.png/)).toBeInTheDocument();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    await user.upload(screen.getByLabelText('Replace page 1'), file('replacement.png'));
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Remove page 2' }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(network).not.toHaveBeenCalled();
  });
  it('accepts dropped files and rejects invalid or oversized files without allocating previews', () => {
    render(<Harness />);
    const drop = screen.getByText(/Or drag images here/).parentElement!;
    fireEvent.drop(drop, { dataTransfer: { files: [file('drop.png'), file('second.png')] } });
    expect(screen.getAllByRole('article')).toHaveLength(2);
    fireEvent.drop(drop, { dataTransfer: { files: [new File(['x'], 'bad.svg', { type: 'image/svg+xml' })] } });
    expect(screen.getByRole('alert')).toHaveTextContent('use JPEG, PNG or WebP');
    const big = file('big.png'); Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });
    fireEvent.drop(drop, { dataTransfer: { files: [big] } });
    expect(screen.getByRole('alert')).toHaveTextContent('up to 10 MB');
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
  });
  it('releases previews on unmount and disables editing while saving', async () => {
    const images: EditorImage[] = [{ id: 'a', previewUrl: 'blob:a', status: 'local', file: file('a.png') }];
    const change = vi.fn();
    const { unmount } = render(<ImageEditor images={images} onChange={change} disabled />);
    expect(screen.getByRole('button', { name: 'Remove page 1' })).toBeDisabled();
    fireEvent.drop(screen.getByText(/Or drag images here/).parentElement!, { dataTransfer: { files: [file('b.png')] } });
    expect(change).not.toHaveBeenCalled(); unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:a');
  });
  it('keeps remote covers visible, replaces locally and removes without uploading',async()=>{
    function Cover() {const [images,setImages]=useState<EditorImage[]>([{id:'remote',previewUrl:'https://existing/cover.png',status:'uploaded'}]);return <ImageEditor cover images={images} onChange={setImages}/>;}
    render(<Cover/>);
    expect(screen.getByRole('img')).toHaveAttribute('src','https://existing/cover.png');
    await userEvent.upload(screen.getByLabelText('Choose cover'),file('cover.png'));
    expect(screen.getByRole('img').getAttribute('src')).toMatch(/^blob:/);
    await userEvent.click(screen.getByRole('button',{name:'Remove page 1'}));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });
});
