declare type TDistance = number;
interface IConfig {
    prefix?: string;
    buttonDistance?: TDistance;
    trackDistance?: TDistance;
    delay?: number;
    repeat?: number;
}
interface IScrollbarProperties {
    nativeHeight: number;
    nativeWidth: number;
    nativeDisplaces: boolean;
    supportsWebkitStyling: boolean;
    supportsMsHiding: boolean;
}
declare const scrollbarjs: {
    add: ($elem: HTMLElement) => void;
    init: (config?: IConfig) => IScrollbarProperties;
};
