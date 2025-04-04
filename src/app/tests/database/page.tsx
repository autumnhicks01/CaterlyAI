import { DatabaseTest } from "./db-test"

export const metadata = {
  title: "Database Tests | CaterlyAI",
  description: "Testing database functionality",
}

export default function DatabaseTestPage() {
  return (
    <div className="container py-12">
      <h1 className="text-3xl font-bold mb-8 text-center">Database Operations Test</h1>
      <div className="max-w-3xl mx-auto">
        <DatabaseTest />
      </div>
    </div>
  )
} 