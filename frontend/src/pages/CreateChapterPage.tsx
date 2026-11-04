import PublicationEditor from "../features/author/PublicationEditor";
import { useParams } from "react-router-dom";
export default function CreateChapterPage() {
  const { chapterId } = useParams();
  return <PublicationEditor kind="chapter" edit={Boolean(chapterId)} />;
}
