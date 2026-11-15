// Interface strings for more languages, one JSON file per language (same keys as English).
// Languages without a file show the English interface; the guide itself is translated into any language.
import { extendStrings } from "../i18n";
import fr from "./fr.json";
import pt from "./pt.json";
import ro from "./ro.json";
import tr from "./tr.json";
import lt from "./lt.json";
import zh from "./zh.json";
import pa from "./pa.json";
import gu from "./gu.json";
import fa from "./fa.json";

extendStrings({ fr, pt, ro, tr, lt, zh, pa, gu, fa });
