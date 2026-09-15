import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent, navigationItems } from './app.component';

describe('AppComponent', () => {
  it('should create the app', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
  it('keeps Settings for learners and staff while adding Admin only for staff', () => {
    expect(navigationItems(false).map(item => item.route)).toContain('/settings');
    expect(navigationItems(false).map(item => item.route)).not.toContain('/admin/users');
    expect(navigationItems(true).map(item => item.route)).toContain('/settings');
    expect(navigationItems(true).map(item => item.route)).toContain('/admin/users');
  });
});
