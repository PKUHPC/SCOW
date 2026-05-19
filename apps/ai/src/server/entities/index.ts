import { algorithmEntitySchema } from "src/server/entities/Algorithm";
import { algorithmVersionEntitySchema } from "src/server/entities/AlgorithmVersion";
import { datasetEntitySchema } from "src/server/entities/Dataset";
import { datasetVersionEntitySchema } from "src/server/entities/DatasetVersion";
import { imageEntitySchema } from "src/server/entities/Image";
import { modelEntitySchema } from "src/server/entities/Model";
import { modelVersionEntitySchema } from "src/server/entities/ModelVersion";

export const entities = [
  algorithmEntitySchema,
  algorithmVersionEntitySchema,
  datasetEntitySchema,
  datasetVersionEntitySchema,
  imageEntitySchema,
  modelEntitySchema,
  modelVersionEntitySchema,
];
