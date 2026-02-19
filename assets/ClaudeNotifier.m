#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>
#import <UserNotifications/UserNotifications.h>

// Delegate handles the authorization callback and notification display
@interface Delegate : NSObject <NSApplicationDelegate, UNUserNotificationCenterDelegate>
@property (nonatomic, copy) NSString *title;
@property (nonatomic, copy) NSString *body;
@property (nonatomic, copy) NSString *sound;
@property (nonatomic, copy) NSString *imagePath;
@end

@implementation Delegate

- (void)applicationDidFinishLaunching:(NSNotification *)note {
    UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
    center.delegate = self;
    [center requestAuthorizationWithOptions:(UNAuthorizationOptionAlert | UNAuthorizationOptionSound)
                          completionHandler:^(BOOL granted, NSError *error) {
        if (granted) {
            [self postNotification:center];
        } else {
            dispatch_async(dispatch_get_main_queue(), ^{ [NSApp terminate:nil]; });
        }
    }];
}

- (void)postNotification:(UNUserNotificationCenter *)center {
    UNMutableNotificationContent *content = [[UNMutableNotificationContent alloc] init];
    content.title = self.title;
    content.body  = self.body;
    content.sound = [UNNotificationSound soundNamed:self.sound];

    if (self.imagePath.length > 0) {
        NSURL *url = [NSURL fileURLWithPath:self.imagePath];
        UNNotificationAttachment *attachment = [UNNotificationAttachment attachmentWithIdentifier:@"image"
                                                                                             URL:url
                                                                                         options:nil
                                                                                           error:nil];
        if (attachment) content.attachments = @[attachment];
    }

    UNNotificationRequest *req = [UNNotificationRequest requestWithIdentifier:[[NSUUID UUID] UUIDString]
                                                                      content:content
                                                                      trigger:nil];
    [center addNotificationRequest:req withCompletionHandler:^(NSError *err) {
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1.5 * NSEC_PER_SEC)),
                       dispatch_get_main_queue(), ^{ [NSApp terminate:nil]; });
    }];
}

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
       willPresentNotification:(UNNotification *)notification
         withCompletionHandler:(void (^)(UNNotificationPresentationOptions))completionHandler {
    completionHandler(UNNotificationPresentationOptionBanner | UNNotificationPresentationOptionSound);
}

@end

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        NSApplication *app = [NSApplication sharedApplication];
        [app setActivationPolicy:NSApplicationActivationPolicyProhibited];

        Delegate *delegate = [[Delegate alloc] init];
        delegate.title     = argc > 1 ? @(argv[1]) : @"Claude Code";
        delegate.body      = argc > 2 ? @(argv[2]) : @"Done";
        delegate.sound     = argc > 3 ? @(argv[3]) : @"Glass";
        delegate.imagePath = argc > 4 ? @(argv[4]) : @"";

        app.delegate = delegate;
        [app run];
    }
    return 0;
}
