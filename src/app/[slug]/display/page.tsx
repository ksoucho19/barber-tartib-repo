import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DisplayScreen } from "@/components/display/DisplayScreen"

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function DisplayPage({ params }: PageProps) {
  const { slug } = await params

  const supabase = await createClient()

  const { data: business, error } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("slug", slug)
    .single()

  if (error || !business) {
    notFound()
  }

  return <DisplayScreen slug={slug} businessName={business.name} />
}
