import { ListPageSkeleton } from "@/components/page-skeletons";

// Settings and Checklist, below this folder, load their own data in the
// browser and never wait on the server, so they don't show this skeleton.
export default function Loading() {
  return <ListPageSkeleton />;
}
