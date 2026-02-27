package adsjava;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Registers {@link InfrastructureInterceptor} with the Spring MVC interceptor chain.
 */
@Configuration
public class InfrastructureMvcConfigurer implements WebMvcConfigurer {

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new InfrastructureInterceptor());
    }
}
