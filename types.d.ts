export interface O2HConfig {
    wrapperOpen: string;
    wrapperClose: string;
    objPropOpen: string;
    objPropClose: string;
    stringPropOpen: string;
    stringPropValue: string;
    stringPropClose: string;
    rootConfig?: O2HConfig;
}