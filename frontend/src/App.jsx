import WorkflowBoard from './components/WorkflowBoard'

function App() {
  return (
    <div className="h-screen w-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-2">
           <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">B</div>
           <h1 className="text-xl font-bold text-slate-800">Brand Guardian AI</h1>
        </div>
        <div className="text-sm text-slate-500">Live Compliance Monitoring</div>
      </header>
      
      <main className="flex-1 overflow-hidden">
        <WorkflowBoard />
      </main>
    </div>
  )
}

export default App
