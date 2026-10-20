import { useEffect } from 'react'
import { HashRouter, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { GardenProvider, useGarden } from './lib/store.tsx'
import { Header, Empty } from './components/ui.tsx'
import { Start } from './screens/Start.tsx'
import { GardenHome } from './screens/GardenHome.tsx'
import { PlantPage } from './screens/PlantPage.tsx'
import { PlantEdit } from './screens/PlantEdit.tsx'
import { Diary } from './screens/Diary.tsx'
import { SpeciesPage, SpeciesList } from './screens/Species.tsx'
import { Settings } from './screens/Settings.tsx'
import { Brand } from './screens/Brand.tsx'
import { PassAccept, PrivateGarden } from './screens/Access.tsx'

/**
 * Hash routes, because GitHub Pages serves files and nothing else. The garden key lives after
 * the "#", so it never reaches any server but the database's.
 *
 *   #/                         start: what this is, create a garden
 *   #/g/<key>                  the garden, by urgency
 *   #/g/<key>/p/<plant>        a plant — the address written on its tag
 *   #/g/<key>/p/<plant>/editar
 *   #/g/<key>/nueva?id=<plant> new plant (the tag can be written first)
 *   #/g/<key>/diario           the diary of the whole garden
 *   #/g/<key>/guia[/<species>] the care guide
 *   #/g/<key>/ajustes          garden settings, access, passes and the list of tag links
 *   #/g/<key>/pase/<token>     keeps a pass on this phone, then opens the garden
 *   #/marca                    the brand manual
 */
export function App() {
  return (
    <HashRouter>
      <ScrollTop />
      <Routes>
        <Route path="/" element={<Start />} />
        <Route path="/marca" element={<Brand />} />
        <Route path="/g/:key/pase/:token" element={<PassAccept />} />
        <Route path="/g/:key" element={<GardenShell />}>
          <Route index element={<GardenHome />} />
          <Route path="p/:plantId" element={<PlantPage />} />
          <Route path="p/:plantId/editar" element={<PlantEdit />} />
          <Route path="nueva" element={<PlantEdit />} />
          <Route path="diario" element={<Diary />} />
          <Route path="guia" element={<SpeciesList />} />
          <Route path="guia/:speciesId" element={<SpeciesPage />} />
          <Route path="ajustes" element={<Settings />} />
        </Route>
        <Route path="*" element={<Start />} />
      </Routes>
    </HashRouter>
  )
}

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo(0, 0), [pathname])
  return null
}

function GardenShell() {
  const { key } = useParams()
  return (
    <GardenProvider gardenKey={key!} key={key}>
      <GardenGate />
    </GardenProvider>
  )
}

/** Holds the screens until there is something to draw: the phone's copy, or the server's. */
function GardenGate() {
  const { status, data } = useGarden()
  if (status === 'private') return <PrivateGarden />
  if (data) return <Outlet />
  return (
    <div className="page no-actions">
      <Header />
      <main className="wrap">
        {status === 'loading' && <Empty title="Abriendo el jardín…" />}
        {status === 'missing' && (
          <Empty title="Este jardín no existe">
            <p className="muted">El link puede estar incompleto. Si el tag es nuevo, creá el jardín desde el inicio y grabalo de nuevo.</p>
            <p><a className="btn btn-primary" href="#/">Ir al inicio</a></p>
          </Empty>
        )}
        {status === 'error' && (
          <Empty title="No hay conexión">
            <p className="muted">La primera vez que se abre un jardín en este teléfono hace falta internet. Probá de nuevo en un rato.</p>
          </Empty>
        )}
      </main>
    </div>
  )
}
