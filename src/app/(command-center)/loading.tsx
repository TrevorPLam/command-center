import { LoadingState } from '@/components/states/loading-state'

export default function CommandCenterLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <LoadingState message="Loading Command Center..." size="lg" />
    </div>
  )
}
