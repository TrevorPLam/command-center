export default function HomePage() {
  return (
    <div className='flex min-h-screen items-center justify-center bg-gray-50'>
      <div className='text-center'>
        <h1 className='mb-4 text-4xl font-bold text-gray-900'>Local AI Command Center</h1>
        <p className='mb-8 text-lg text-gray-600'>
          A local-first, panel-driven control surface for AI operations
        </p>
        <div className='mx-auto max-w-md rounded-lg border border-blue-200 bg-blue-50 p-6'>
          <h2 className='mb-2 text-lg font-semibold text-blue-900'>🚀 Project Status</h2>
          <p className='text-blue-700'>
            Next.js 15 App Router initialized successfully. Ready for development of the command
            center interface.
          </p>
        </div>
      </div>
    </div>
  )
}
