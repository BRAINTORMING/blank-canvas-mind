import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const STORAGE_KEY = "gdudex:responsible-use-accepted";

export default function ResponsibleUseNotice() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    const key = `${STORAGE_KEY}:${user.id}`;
    const accepted = sessionStorage.getItem(key);
    if (!accepted) setOpen(true);
  }, [user, loading]);

  const handleAccept = () => {
    if (user) sessionStorage.setItem(`${STORAGE_KEY}:${user.id}`, new Date().toISOString());
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => { /* require explicit accept */ }}>
      <DialogContent
        className="max-w-2xl p-0 overflow-hidden rounded-[20px] border-0 shadow-2xl z-[3000] [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-8 pt-7 pb-4 border-b border-border bg-background">
          <div className="flex items-center gap-3">
<div className="h-10 w-10 rounded-[12px] bg-primary/10 flex items-center justify-center shrink-0">
  <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="font-display text-xl font-bold text-foreground leading-tight">
                Aviso de Uso Responsable, Confianza Digital y Cumplimiento Normativo
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">Lea atentamente antes de continuar</p>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] px-8 py-6 bg-background">
          <article className="space-y-4 text-[14px] leading-relaxed text-foreground text-justify font-graphik">
            <p>Bienvenido a <strong>GdudeX</strong>.</p>

            <p>
              <strong>GdudeX</strong> es un <strong>Motor de Inteligencia Geoespacial</strong> que integra información territorial, ambiental, regulatoria, patrimonial, social y de inversión proveniente de fuentes públicas, privadas y oficiales autorizadas, con el propósito de apoyar procesos de análisis, planificación y toma de decisiones informadas.
            </p>

            <p>
              La información, visualizaciones, análisis territoriales, consultas geoespaciales, resultados generados mediante <strong>Inteligencia Artificial</strong>, mapas, capas temáticas, radios de influencia, indicadores y reportes disponibles en la plataforma tienen <strong>carácter referencial, informativo y de apoyo a la gestión</strong>. En consecuencia, no sustituyen evaluaciones técnicas, jurídicas, ambientales, regulatorias, sectoriales o administrativas que deban ser realizadas por los organismos competentes o por profesionales especializados.
            </p>

            <p>
              Las coordenadas, ubicaciones, delimitaciones territoriales, análisis radiales, áreas de influencia, polígonos, rutas, corredores logísticos, visualizaciones cartográficas y demás representaciones geográficas constituyen <strong>aproximaciones</strong> basadas en la información disponible al momento de la consulta, pudiendo estar sujetas a actualizaciones, diferencias de escala, precisión cartográfica, disponibilidad de fuentes y modificaciones realizadas por las instituciones responsables de su generación y mantención.
            </p>

            <p>
              GdudeX ha sido diseñado bajo principios de <strong>seguridad por diseño</strong>, <strong>privacidad por diseño</strong>, <strong>interoperabilidad responsable</strong> y <strong>uso ético de la Inteligencia Artificial</strong>, promoviendo el acceso a información territorial de manera segura, transparente y conforme a la legislación vigente.
            </p>

            <div>
              <p className="mb-2">La plataforma respeta y protege la información relacionada con:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Datos personales y privacidad de las personas.</li>
                <li>Patrimonio cultural, arqueológico e histórico.</li>
                <li>Ecosistemas sensibles y patrimonio ambiental.</li>
                <li>Comunidades y territorios de especial protección.</li>
                <li>Infraestructura estratégica y crítica.</li>
                <li>Información territorial sujeta a regulación sectorial.</li>
                <li>Integridad cartográfica y representación oficial del territorio nacional.</li>
              </ul>
            </div>

            <p>
              GdudeX <strong>no tiene por finalidad divulgar, exponer, comprometer ni facilitar el acceso</strong> a información cuya difusión pueda afectar la seguridad nacional, la soberanía territorial, la infraestructura crítica del país o cualquier información restringida por la normativa vigente. Del mismo modo, la plataforma no promueve ni autoriza el uso de la información para fines ilícitos, fraudulentos o contrarios al interés público.
            </p>

            <p>
              Los resultados generados mediante Inteligencia Artificial corresponden a análisis automatizados orientados a apoyar la interpretación del territorio y la identificación preliminar de riesgos, restricciones, oportunidades y escenarios. Dichos resultados deben ser considerados como <strong>apoyo a la toma de decisiones</strong> y no como una conclusión definitiva, recomendándose siempre la validación mediante fuentes oficiales y organismos competentes.
            </p>

            <p>
              GdudeX promueve una visión de <strong>desarrollo sostenible</strong> basada en la comprensión integral del territorio, fomentando la identificación temprana de restricciones ambientales, patrimoniales, sociales y regulatorias, con el objetivo de contribuir a una mejor planificación, reducir incertidumbre y fortalecer procesos de inversión y gestión territorial responsables.
            </p>

            <div>
              <h3 className="font-display font-semibold text-foreground mb-2">Principios de Confianza GdudeX</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Protección de Datos Personales.</li>
                <li>Ciberseguridad y Resiliencia Digital.</li>
                <li>Inteligencia Artificial Responsable.</li>
                <li>Protección Patrimonial, Ambiental y Territorial.</li>
                <li>Integridad Cartográfica y Resguardo Territorial.</li>
                <li>Gobernanza Territorial e Interoperabilidad.</li>
              </ul>
            </div>

            <div>
              <h3 className="font-display font-semibold text-foreground mb-2">Marco de Cumplimiento Normativo</h3>
              <p className="mb-2">
                GdudeX desarrolla sus servicios considerando las disposiciones y principios contenidos en la normativa aplicable, incluyendo entre otras:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Ley N° 21.719</strong> sobre Protección de Datos Personales.</li>
                <li><strong>Ley N° 21.663</strong> Marco de Ciberseguridad.</li>
                <li><strong>Ley N° 17.288</strong> sobre Monumentos Nacionales y Protección del Patrimonio Cultural.</li>
                <li><strong>Ley N° 19.300</strong> sobre Bases Generales del Medio Ambiente y normativa sectorial relacionada.</li>
                <li><strong>Ley N° 16.643</strong> relativa a la integridad cartográfica y representación territorial de la República de Chile.</li>
                <li>Normativa emitida por el <strong>Instituto Geográfico Militar (IGM)</strong>, <strong>Servicio Hidrográfico y Oceanográfico de la Armada (SHOA)</strong> y demás organismos competentes.</li>
                <li>Principios internacionales de Inteligencia Artificial Responsable, transparencia algorítmica y gestión ética de datos.</li>
              </ul>
            </div>

            <p>
              Al acceder y utilizar la plataforma, el usuario <strong>declara conocer y aceptar</strong> los presentes lineamientos, así como los Términos y Condiciones, Políticas de Privacidad, Políticas de Seguridad y demás documentos de gobernanza y cumplimiento establecidos por GdudeX.
            </p>

            <p>
              El compromiso de GdudeX es contribuir a una toma de decisiones más informada, segura y responsable, transformando información territorial compleja en conocimiento útil, sin comprometer la seguridad, el patrimonio, el medio ambiente, los datos personales ni la integridad territorial de la República de Chile.
            </p>

            <p className="pt-2 text-right italic text-muted-foreground">
              Atentamente,<br />
              <span className="font-semibold text-foreground not-italic">Team Gdudex</span>
            </p>
          </article>
        </ScrollArea>

        <DialogFooter className="px-8 py-5 border-t border-border bg-muted/30">
          <Button
            onClick={handleAccept}
            className="w-full sm:w-auto h-11 px-8 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Acepto y continúo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
