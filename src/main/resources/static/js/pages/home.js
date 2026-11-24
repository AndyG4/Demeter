import { el } from "../utils/dom.js";
import { createHeader } from "../organisms/header.js";
import { createHero } from "../organisms/hero.js";
import { createExplorer } from "../organisms/explorer.js";
import { createModelSection } from "../organisms/model-section.js";
import { createDataSection } from "../organisms/data-section.js";
import { createMethodSection } from "../organisms/method-section.js";
import { createFooter } from "../organisms/footer.js";
import { createCinematicForest } from "../cinematic-forest.js";





export function createHome() {
  const header = createHeader();
  const hero = createHero();
  const explorer = createExplorer();
  const modelSection = createModelSection();
  const dataSection = createDataSection();
  const methodSection = createMethodSection();
  const footer = createFooter();

  const chapter = el("div", { class: "cinematic-chapter" },
    modelSection.node,
    dataSection,
    methodSection
  );
  createCinematicForest(chapter);

  const page = el("div", { class: "page" },
    header.node,
    el("main", { id: "contenido" },
      hero.node,
      explorer.node,
      chapter
    ),
    footer
  );

  return { page, header, hero, explorer, modelSection };
}
