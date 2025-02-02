/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { IStorageNameRetriever } from "@fluidframework/server-services-core";

export interface IHistorianResourcesCustomizations {
	storageNameRetriever?: IStorageNameRetriever;
}
