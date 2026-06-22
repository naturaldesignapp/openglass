import { Hero } from './Hero'
import { MaterialSection } from './MaterialSection'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'
import { StoryStage } from './StoryStage'
import { TryItSection } from './TryItSection'

export function App() {
  return (
    <>
      <SiteHeader />
      <Hero />
      <TryItSection />
      <StoryStage />
      <MaterialSection />
      <SiteFooter />
    </>
  )
}
