import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import api from '../../lib/axios';
import PublicationEditor from './PublicationEditor';
import { uploadImages } from './images';
vi.mock('../../lib/axios', () => ({ default: { get: vi.fn(), request: vi.fn() } }));
vi.mock('./images', async original => ({ ...await original<typeof import('./images')>(), uploadImages: vi.fn() }));
function renderEditor() {
  const router = createMemoryRouter([{ path:'/author/comic/:bookId/chapter/:chapterId/edit',element:<PublicationEditor kind="chapter" edit /> },{path:'/author/dashboard',element:<p>Dashboard</p>}], { initialEntries:['/author/comic/10/chapter/20/edit'] });
  return { router,...render(<RouterProvider router={router} />) };
}
describe('publication editor lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation(async url => ({ data:{ metadata:url.endsWith('/chapters/20') ? { title:'Chapter',contentMarkdown:'Legacy text',visibility:'PUBLIC',isDraft:true,images:[{id:'old',imageUrl:'https://saved'}] } : { title:'My Book' } } }));
    vi.mocked(uploadImages).mockResolvedValue(['old']);
    vi.mocked(api.request).mockResolvedValue({data:{metadata:{chapterId:20}}});
  });
  it('loads existing pages and text, blocks duplicate submits, and publishes only after upload completion',async()=>{
    let finish!: (ids:string[])=>void;
    vi.mocked(uploadImages).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
    renderEditor();
    await screen.findByDisplayValue('Chapter');
    expect(screen.getByLabelText('Chapter text')).toHaveValue('Legacy text');
    const publish=screen.getByRole('button',{name:'Publish Chapter'});
    await userEvent.click(publish); await userEvent.click(publish);
    expect(publish).toBeDisabled(); expect(api.request).not.toHaveBeenCalled();
    finish(['old']);
    await waitFor(()=>expect(api.request).toHaveBeenCalledTimes(1));
    expect(api.request).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({isDraft:false,imageAssetIds:['old'],contentMd:'Legacy text'})}));
    await screen.findByText('Published successfully.');
  });
  it('preserves edits after failure and reuses the same idempotency key on retry',async()=>{
    vi.mocked(api.request).mockRejectedValueOnce(new Error('Network lost'));
    renderEditor(); await screen.findByDisplayValue('Chapter');
    await userEvent.clear(screen.getByLabelText('Title')); await userEvent.type(screen.getByLabelText('Title'),'Edited');
    await userEvent.click(screen.getByRole('button',{name:'Save Draft'}));
    await screen.findByText('Network lost'); expect(screen.getByLabelText('Title')).toHaveValue('Edited');
    await userEvent.click(screen.getByRole('button',{name:'Save Draft'}));
    await screen.findByText('Draft saved successfully.');
    const calls=vi.mocked(api.request).mock.calls;
    expect((calls[0][0].data as { requestId: string }).requestId).toBe((calls[1][0].data as { requestId: string }).requestId);
  });
  it('protects unsaved work on internal navigation',async()=>{
    const { router }=renderEditor(); await screen.findByDisplayValue('Chapter');
    await userEvent.type(screen.getByLabelText('Title'),' changed');
    await userEvent.click(screen.getByRole('link',{name:'← My books'}));
    expect(screen.getByRole('dialog',{name:'Unsaved changes'})).toBeInTheDocument();
    expect(router.state.location.pathname).toContain('/chapter/20/edit');
    await userEvent.click(screen.getByRole('button',{name:'Stay'}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('resolves an ambiguous creation before saving later edits to the same book',async()=>{
    vi.mocked(uploadImages).mockResolvedValue([]);
    vi.mocked(api.request).mockRejectedValueOnce(new Error('Response lost'))
      .mockResolvedValueOnce({data:{metadata:{id:99,slug:'saved'}}})
      .mockResolvedValueOnce({data:{metadata:{id:99,slug:'saved'}}});
    const router=createMemoryRouter([{path:'/new',element:<PublicationEditor kind="book"/>},{path:'/author/comic/:bookId/edit',element:<p>Saved book</p>}],{initialEntries:['/new']});
    render(<RouterProvider router={router}/>);
    await userEvent.type(screen.getByLabelText('Title'),'First title');await userEvent.type(screen.getByLabelText('Genre'),'Novel');
    await userEvent.click(screen.getByRole('button',{name:'Save Draft'}));await screen.findByText('Response lost');
    await userEvent.clear(screen.getByLabelText('Title'));await userEvent.type(screen.getByLabelText('Title'),'Later edits');
    await userEvent.click(screen.getByRole('button',{name:'Save Draft'}));await screen.findByText('Saved book');
    const calls=vi.mocked(api.request).mock.calls.map(([config])=>config);
    expect(calls).toHaveLength(3);
    expect(calls[1].data).toEqual(calls[0].data);
    expect(calls[2]).toMatchObject({url:'/authors/me/books/99',method:'PATCH',data:{title:'Later edits'}});
  });
});
