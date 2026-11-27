import { ListPageSkeleton } from "@/components/page-skeletons";

// Settings loads its own data in the browser and never waits on the server,
// so it doesn't show this skeleton. Checklist has its own.
export default function Loading() {
  return <ListPageSkeleton />;
}
