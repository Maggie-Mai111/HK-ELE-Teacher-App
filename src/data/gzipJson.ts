// Portable entry for tools without Metro's platform selection. Native and web
// builds keep selecting their corresponding platform-specific adapters.
export { loadGzipJson, inflateRecord } from "./gzipJson.web";
