declare module "geojson" {
  export type Position = [number, number] | [number, number, number];

  export interface Geometry {
    type: string;
    coordinates?: unknown;
    geometries?: Geometry[];
  }

  export interface LineString extends Geometry {
    type: "LineString";
    coordinates: Position[];
  }

  export interface Feature<G extends Geometry = Geometry, P = Record<string, unknown>> {
    type: "Feature";
    geometry: G;
    properties: P;
    id?: string | number;
  }

  export interface FeatureCollection<
    G extends Geometry = Geometry,
    P = Record<string, unknown>
  > {
    type: "FeatureCollection";
    features: Array<Feature<G, P>>;
  }
}
